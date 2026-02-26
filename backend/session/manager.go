package session

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Status constants
const (
	StatusIdle     = "idle"
	StatusThinking = "thinking"
	StatusWaiting  = "waiting"
	StatusStopped  = "stopped"
	StatusErrored  = "errored"
)

// SessionConfig is provided by the frontend when creating a new session.
type SessionConfig struct {
	Name         string `json:"name"`
	Agent        string `json:"agent"`        // "claude", "codex", "shell"
	Directory    string `json:"directory"`    // working directory
	UseWorktree  bool   `json:"useWorktree"`
	WorktreePath string `json:"worktreePath"` // filled in by backend if useWorktree
	Branch       string `json:"branch"`       // git branch for worktree
}

// Session is the runtime session record.
type Session struct {
	ID      string        `json:"id"`
	Config  SessionConfig `json:"config"`
	WorkDir string        `json:"workDir"` // actual working directory (worktree or dir)
}

// SessionState is what gets persisted and returned to the frontend.
type SessionState struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Agent        string `json:"agent"`
	Directory    string `json:"directory"`
	WorktreePath string `json:"worktreePath"`
	Branch       string `json:"branch"`
	Status       string `json:"status"`
}

// Manager manages all active sessions.
type Manager struct {
	mu        sync.RWMutex
	ctx       context.Context
	sessions  map[string]*Session
	ptySessions map[string]*ptySession
	statuses  map[string]string
	persister *persister
}

func NewManager() *Manager {
	return &Manager{
		sessions:    make(map[string]*Session),
		ptySessions: make(map[string]*ptySession),
		statuses:    make(map[string]string),
		persister:   newPersister(),
	}
}

func (m *Manager) SetContext(ctx context.Context) {
	m.ctx = ctx
	// Load persisted sessions on startup
	m.loadPersistedSessions()
}

func (m *Manager) loadPersistedSessions() {
	sessions, err := m.persister.loadSessions()
	if err != nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, ss := range sessions {
		workDir := ss.Directory
		if ss.WorktreePath != "" {
			workDir = ss.WorktreePath
		}
		m.sessions[ss.ID] = &Session{
			ID: ss.ID,
			Config: SessionConfig{
				Name:         ss.Name,
				Agent:        ss.Agent,
				Directory:    ss.Directory,
				UseWorktree:  ss.WorktreePath != "",
				WorktreePath: ss.WorktreePath,
				Branch:       ss.Branch,
			},
			WorkDir: workDir,
		}
		m.statuses[ss.ID] = StatusStopped
	}
}

// CreateSession creates a new session and spawns the PTY process.
func (m *Manager) CreateSession(config SessionConfig) (string, error) {
	id := uuid.New().String()
	workDir := config.Directory
	if config.UseWorktree && config.WorktreePath != "" {
		workDir = config.WorktreePath
	}

	s := &Session{
		ID:      id,
		Config:  config,
		WorkDir: workDir,
	}

	m.mu.Lock()
	m.sessions[id] = s
	m.statuses[id] = StatusIdle
	m.mu.Unlock()

	ps, err := spawnPTY(s, m)
	if err != nil {
		m.mu.Lock()
		delete(m.sessions, id)
		delete(m.statuses, id)
		m.mu.Unlock()
		return "", fmt.Errorf("spawn PTY: %w", err)
	}

	m.mu.Lock()
	m.ptySessions[id] = ps
	m.mu.Unlock()

	m.persist()
	return id, nil
}

// ResumeSession re-spawns a stopped session.
func (m *Manager) ResumeSession(id string) error {
	m.mu.RLock()
	s, ok := m.sessions[id]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("session %s not found", id)
	}

	ps, err := spawnPTY(s, m)
	if err != nil {
		return fmt.Errorf("spawn PTY: %w", err)
	}

	m.mu.Lock()
	m.ptySessions[id] = ps
	m.statuses[id] = StatusIdle
	m.mu.Unlock()
	return nil
}

// WriteToSession sends input to the PTY stdin.
func (m *Manager) WriteToSession(id string, data string) error {
	m.mu.RLock()
	ps, ok := m.ptySessions[id]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("session %s not active", id)
	}
	return ps.write(data)
}

// ResizeSession resizes the PTY window.
func (m *Manager) ResizeSession(id string, cols int, rows int) error {
	m.mu.RLock()
	ps, ok := m.ptySessions[id]
	m.mu.RUnlock()
	if !ok {
		return nil // ignore resize for inactive sessions
	}
	return ps.resize(cols, rows)
}

// CloseSession kills the PTY process and removes the session.
func (m *Manager) CloseSession(id string) error {
	m.mu.Lock()
	ps, hasPTY := m.ptySessions[id]
	delete(m.ptySessions, id)
	delete(m.sessions, id)
	delete(m.statuses, id)
	m.mu.Unlock()

	if hasPTY {
		_ = ps.kill()
	}
	m.persist()
	return nil
}

// ListSessions returns all known sessions with their current status.
func (m *Manager) ListSessions() []SessionState {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]SessionState, 0, len(m.sessions))
	for id, s := range m.sessions {
		result = append(result, SessionState{
			ID:           id,
			Name:         s.Config.Name,
			Agent:        s.Config.Agent,
			Directory:    s.Config.Directory,
			WorktreePath: s.Config.WorktreePath,
			Branch:       s.Config.Branch,
			Status:       m.statuses[id],
		})
	}
	return result
}

// GetSessionLog returns the scrollback log for a session.
func (m *Manager) GetSessionLog(id string) (string, error) {
	return m.persister.loadScrollback(id)
}

// updateStatus updates session status and emits event.
func (m *Manager) updateStatus(id string, status string) {
	m.mu.Lock()
	m.statuses[id] = status
	if ps, ok := m.ptySessions[id]; ok {
		ps.mu.Lock()
		ps.status = status
		ps.mu.Unlock()
	}
	m.mu.Unlock()
	runtime.EventsEmit(m.ctx, fmt.Sprintf("session:status:%s", id), status)
}

// detectStatus infers session status from PTY output chunk.
func (m *Manager) detectStatus(id string, chunk []byte) {
	output := string(chunk)

	// Update to thinking if we see agent output content
	m.mu.RLock()
	currentStatus := m.statuses[id]
	m.mu.RUnlock()

	newStatus := currentStatus

	// Check Claude/Codex patterns
	for _, pat := range claudePatterns {
		if strings.Contains(output, pat.pattern) {
			newStatus = pat.status
			break
		}
	}

	if newStatus != currentStatus {
		m.updateStatus(id, newStatus)
	} else if currentStatus == StatusIdle || currentStatus == StatusStopped {
		// Any output while idle means thinking
		if len(strings.TrimSpace(output)) > 0 {
			m.updateStatus(id, StatusThinking)
		}
	}
}

// persist saves current session list to disk.
func (m *Manager) persist() {
	m.mu.RLock()
	sessions := make([]SessionState, 0, len(m.sessions))
	for id, s := range m.sessions {
		sessions = append(sessions, SessionState{
			ID:           id,
			Name:         s.Config.Name,
			Agent:        s.Config.Agent,
			Directory:    s.Config.Directory,
			WorktreePath: s.Config.WorktreePath,
			Branch:       s.Config.Branch,
			Status:       m.statuses[id],
		})
	}
	m.mu.RUnlock()
	_ = m.persister.saveSessions(sessions)
}

// Shutdown kills all active PTY sessions.
func (m *Manager) Shutdown() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, ps := range m.ptySessions {
		_ = ps.kill()
	}
}
