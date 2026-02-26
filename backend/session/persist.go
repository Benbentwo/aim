package session

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

const maxScrollbackLines = 10000

type persister struct {
	mu      sync.Mutex
	baseDir string
}

func newPersister() *persister {
	confDir, _ := os.UserConfigDir()
	return &persister{
		baseDir: filepath.Join(confDir, "aim"),
	}
}

func (p *persister) sessionsFile() string {
	return filepath.Join(p.baseDir, "sessions.json")
}

func (p *persister) sessionDir(id string) string {
	return filepath.Join(p.baseDir, "sessions", id)
}

func (p *persister) scrollbackFile(id string) string {
	return filepath.Join(p.sessionDir(id), "scrollback.log")
}

func (p *persister) loadSessions() ([]SessionState, error) {
	data, err := os.ReadFile(p.sessionsFile())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var sessions []SessionState
	if err := json.Unmarshal(data, &sessions); err != nil {
		return nil, err
	}
	return sessions, nil
}

func (p *persister) saveSessions(sessions []SessionState) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if err := os.MkdirAll(p.baseDir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(sessions, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p.sessionsFile(), data, 0644)
}

func (p *persister) appendScrollback(id string, data []byte) error {
	dir := p.sessionDir(id)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	f, err := os.OpenFile(p.scrollbackFile(id), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.Write(data)
	return err
}

func (p *persister) loadScrollback(id string) (string, error) {
	data, err := os.ReadFile(p.scrollbackFile(id))
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", fmt.Errorf("reading scrollback: %w", err)
	}
	return string(data), nil
}

func (p *persister) clearScrollback(id string) error {
	return os.Remove(p.scrollbackFile(id))
}
