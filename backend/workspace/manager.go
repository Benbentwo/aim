package workspace

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/Benbentwo/aim/backend/session"
	"github.com/Benbentwo/aim/backend/worktree"
	"github.com/google/uuid"
)

// Workspace represents a git repository registered with aim.
type Workspace struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Path   string `json:"path"`
	Agent  string `json:"agent"`
	Cloned bool   `json:"cloned"`
}

// WorkspaceWithSessions is returned to the frontend.
type WorkspaceWithSessions struct {
	Workspace
	Sessions []session.SessionState `json:"sessions"`
}

// AddWorkspaceConfig is sent from the frontend.
type AddWorkspaceConfig struct {
	Path         string `json:"path"`
	RepoURL      string `json:"repoUrl"`
	ReposBaseDir string `json:"reposBaseDir"`
	Name         string `json:"name"`
	Agent        string `json:"agent"`
}

// Manager manages workspaces (registered repositories).
type Manager struct {
	mu              sync.RWMutex
	ctx             context.Context
	workspaces      map[string]*Workspace
	confPath        string
	sessionManager  *session.Manager
	worktreeManager *worktree.Manager
}

func NewManager(sessionMgr *session.Manager, worktreeMgr *worktree.Manager) *Manager {
	confDir, _ := os.UserConfigDir()
	return &Manager{
		workspaces:      make(map[string]*Workspace),
		confPath:        filepath.Join(confDir, "aim", "workspaces.json"),
		sessionManager:  sessionMgr,
		worktreeManager: worktreeMgr,
	}
}

func (m *Manager) SetContext(ctx context.Context) {
	m.ctx = ctx
	m.load()
}

// AddWorkspace registers a local directory as a workspace and creates its initial session.
func (m *Manager) AddWorkspace(config AddWorkspaceConfig) (string, error) {
	if config.Path == "" {
		return "", fmt.Errorf("path is required")
	}
	if _, err := os.Stat(config.Path); err != nil {
		return "", fmt.Errorf("directory not found: %s", config.Path)
	}

	id := uuid.New().String()
	name := config.Name
	if name == "" {
		name = filepath.Base(config.Path)
	}
	agent := config.Agent
	if agent == "" {
		agent = "claude"
	}

	ws := &Workspace{
		ID:    id,
		Name:  name,
		Path:  config.Path,
		Agent: agent,
	}

	m.mu.Lock()
	m.workspaces[id] = ws
	m.mu.Unlock()

	// Create the initial session for this workspace
	_, err := m.sessionManager.CreateSession(session.SessionConfig{
		Name:        name,
		Agent:       agent,
		Directory:   config.Path,
		WorkspaceID: id,
	})
	if err != nil {
		m.mu.Lock()
		delete(m.workspaces, id)
		m.mu.Unlock()
		return "", fmt.Errorf("create initial session: %w", err)
	}

	m.save()
	return id, nil
}

// CloneAndAddWorkspace clones a git repo then registers it as a workspace.
func (m *Manager) CloneAndAddWorkspace(config AddWorkspaceConfig) (string, error) {
	if config.RepoURL == "" {
		return "", fmt.Errorf("repoUrl is required")
	}

	destPath, err := m.worktreeManager.CloneDestPath(config.RepoURL, config.ReposBaseDir)
	if err != nil {
		return "", fmt.Errorf("resolve clone path: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return "", fmt.Errorf("create parent dir: %w", err)
	}

	if err := m.worktreeManager.CloneRepo(config.RepoURL, destPath); err != nil {
		return "", err
	}

	config.Path = destPath
	config.RepoURL = ""

	wsID, err := m.AddWorkspace(config)
	if err != nil {
		return "", err
	}

	// Mark as cloned
	m.mu.Lock()
	if w, ok := m.workspaces[wsID]; ok {
		w.Cloned = true
	}
	m.mu.Unlock()
	m.save()

	return wsID, nil
}

// ListWorkspaces returns all workspaces with their sessions.
func (m *Manager) ListWorkspaces() []WorkspaceWithSessions {
	m.mu.RLock()
	defer m.mu.RUnlock()

	allSessions := m.sessionManager.ListSessions()
	byWorkspace := make(map[string][]session.SessionState)
	for _, s := range allSessions {
		byWorkspace[s.WorkspaceID] = append(byWorkspace[s.WorkspaceID], s)
	}

	result := make([]WorkspaceWithSessions, 0, len(m.workspaces))
	for _, ws := range m.workspaces {
		result = append(result, WorkspaceWithSessions{
			Workspace: *ws,
			Sessions:  byWorkspace[ws.ID],
		})
	}
	return result
}

// RemoveWorkspace removes a workspace and closes all its sessions.
func (m *Manager) RemoveWorkspace(id string) error {
	allSessions := m.sessionManager.ListSessions()
	for _, s := range allSessions {
		if s.WorkspaceID == id {
			_ = m.sessionManager.CloseSession(s.ID)
		}
	}
	m.mu.Lock()
	delete(m.workspaces, id)
	m.mu.Unlock()
	m.save()
	return nil
}

// CloneDestPreview returns the expected clone destination path without cloning.
func (m *Manager) CloneDestPreview(repoURL string, reposBaseDir string) (string, error) {
	return m.worktreeManager.CloneDestPath(repoURL, reposBaseDir)
}

func (m *Manager) load() {
	data, err := os.ReadFile(m.confPath)
	if err != nil {
		return
	}
	var workspaces []Workspace
	if err := json.Unmarshal(data, &workspaces); err != nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range workspaces {
		ws := workspaces[i]
		m.workspaces[ws.ID] = &ws
	}
}

func (m *Manager) save() {
	m.mu.RLock()
	workspaces := make([]Workspace, 0, len(m.workspaces))
	for _, ws := range m.workspaces {
		workspaces = append(workspaces, *ws)
	}
	m.mu.RUnlock()

	if err := os.MkdirAll(filepath.Dir(m.confPath), 0755); err != nil {
		return
	}
	data, err := json.MarshalIndent(workspaces, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(m.confPath, data, 0644)
}
