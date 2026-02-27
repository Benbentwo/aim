package linear

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// PrepareWorkspace creates the workspace directory for a Linear task.
func (m *Manager) PrepareWorkspace(issueIdentifier string, baseDir string) (string, error) {
	dir := filepath.Join(baseDir, "linear", issueIdentifier)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("create workspace dir: %w", err)
	}
	return dir, nil
}

// ListRepoDirectories returns all git repo paths found in the base directory (1 level deep).
func (m *Manager) ListRepoDirectories(baseDir string) ([]string, error) {
	entries, err := os.ReadDir(baseDir)
	if err != nil {
		return nil, fmt.Errorf("read base dir: %w", err)
	}

	var repos []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		gitDir := filepath.Join(baseDir, entry.Name(), ".git")
		if info, err := os.Stat(gitDir); err == nil && info.IsDir() {
			repos = append(repos, filepath.Join(baseDir, entry.Name()))
		}
	}
	return repos, nil
}

// DetectReposPrompt generates the prompt for the agent to determine relevant repos.
func (m *Manager) DetectReposPrompt(issueTitle, issueDescription string, repos []string) string {
	repoList := strings.Join(repos, "\n  - ")
	return fmt.Sprintf(`Given this Linear task:
Title: %s
Description: %s

Which of these repositories are relevant to this task? List only the full paths, one per line, with no other text:
  - %s`, issueTitle, issueDescription, repoList)
}
