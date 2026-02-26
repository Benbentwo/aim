package worktree

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

type WorktreeInfo struct {
	Path   string `json:"path"`
	Branch string `json:"branch"`
	Hash   string `json:"hash"`
}

type Manager struct {
	ctx context.Context
}

func NewManager() *Manager {
	return &Manager{}
}

func (m *Manager) SetContext(ctx context.Context) {
	m.ctx = ctx
}

// IsGitRepo returns true if path is inside a git repository.
func (m *Manager) IsGitRepo(path string) bool {
	cmd := exec.Command("git", "-C", path, "rev-parse", "--git-dir")
	return cmd.Run() == nil
}

// CreateWorktree runs `git worktree add <worktreePath> <branch>` in repoPath.
// If branch does not exist it creates it with -b.
func (m *Manager) CreateWorktree(repoPath string, branch string) (string, error) {
	// Sanitize branch name for use as dir suffix
	safe := strings.ReplaceAll(branch, "/", "-")
	worktreePath := repoPath + "/.git/aim-worktrees/" + safe

	// Try to add using existing branch first
	cmd := exec.Command("git", "-C", repoPath, "worktree", "add", worktreePath, branch)
	out, err := cmd.CombinedOutput()
	if err != nil {
		// Try creating new branch
		cmd2 := exec.Command("git", "-C", repoPath, "worktree", "add", "-b", branch, worktreePath)
		out2, err2 := cmd2.CombinedOutput()
		if err2 != nil {
			return "", fmt.Errorf("git worktree add failed: %s\n%s", string(out), string(out2))
		}
	}
	return worktreePath, nil
}

// ListWorktrees returns worktrees for the repo at repoPath.
func (m *Manager) ListWorktrees(repoPath string) ([]WorktreeInfo, error) {
	cmd := exec.Command("git", "-C", repoPath, "worktree", "list", "--porcelain")
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git worktree list: %w", err)
	}
	return parseWorktreeList(string(out)), nil
}

// RemoveWorktree removes the worktree at worktreePath.
func (m *Manager) RemoveWorktree(repoPath string, worktreePath string) error {
	cmd := exec.Command("git", "-C", repoPath, "worktree", "remove", "--force", worktreePath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git worktree remove: %s", string(out))
	}
	return nil
}

func parseWorktreeList(output string) []WorktreeInfo {
	var result []WorktreeInfo
	var current WorktreeInfo
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			if current.Path != "" {
				result = append(result, current)
			}
			current = WorktreeInfo{}
			continue
		}
		if strings.HasPrefix(line, "worktree ") {
			current.Path = strings.TrimPrefix(line, "worktree ")
		} else if strings.HasPrefix(line, "HEAD ") {
			current.Hash = strings.TrimPrefix(line, "HEAD ")
		} else if strings.HasPrefix(line, "branch ") {
			b := strings.TrimPrefix(line, "branch ")
			b = strings.TrimPrefix(b, "refs/heads/")
			current.Branch = b
		}
	}
	if current.Path != "" {
		result = append(result, current)
	}
	return result
}
