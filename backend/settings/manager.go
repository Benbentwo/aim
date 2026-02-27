package settings

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
)

type Settings struct {
	DefaultAgent                string `json:"defaultAgent"`                // "claude", "codex", "shell"
	DefaultWorktree             bool   `json:"defaultWorktree"`             // true = create worktree by default
	Theme                       string `json:"theme"`                       // "dark", "light"
	ShellPath                   string `json:"shellPath"`                   // e.g. /bin/zsh
	ReposBaseDir                string `json:"reposBaseDir"`                // base dir for cloned repos
	ArchiveWorktreeCleanupDays  int    `json:"archiveWorktreeCleanupDays"`  // days before stale worktrees are removed
}

type Manager struct {
	ctx      context.Context
	confPath string
}

func NewManager() *Manager {
	confDir, _ := os.UserConfigDir()
	return &Manager{
		confPath: filepath.Join(confDir, "aim", "settings.json"),
	}
}

func (m *Manager) SetContext(ctx context.Context) {
	m.ctx = ctx
}

func (m *Manager) GetSettings() Settings {
	data, err := os.ReadFile(m.confPath)
	if err != nil {
		return m.defaults()
	}
	var s Settings
	if err := json.Unmarshal(data, &s); err != nil {
		return m.defaults()
	}
	return s
}

func (m *Manager) SaveSettings(s Settings) error {
	if err := os.MkdirAll(filepath.Dir(m.confPath), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(m.confPath, data, 0644)
}

func (m *Manager) defaults() Settings {
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/zsh"
	}
	home, _ := os.UserHomeDir()
	return Settings{
		DefaultAgent:               "claude",
		DefaultWorktree:            true,
		Theme:                      "dark",
		ShellPath:                  shell,
		ReposBaseDir:               filepath.Join(home, ".aim", "repos"),
		ArchiveWorktreeCleanupDays: 7,
	}
}
