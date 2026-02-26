package worktree

import (
	"context"
	"fmt"
	"net/url"
	"os/exec"
	"path/filepath"
	"strings"
)

type WorktreeInfo struct {
	Path   string `json:"path"`
	Branch string `json:"branch"`
	Hash   string `json:"hash"`
}

// RepoURL holds parsed components of a Git remote URL.
type RepoURL struct {
	Host string `json:"host"`
	Org  string `json:"org"`
	Repo string `json:"repo"`
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

func (m *Manager) IsGitRepo(path string) bool {
	cmd := exec.Command("git", "-C", path, "rev-parse", "--git-dir")
	return cmd.Run() == nil
}

func (m *Manager) CreateWorktree(repoPath string, branch string) (string, error) {
	safe := strings.ReplaceAll(branch, "/", "-")
	worktreePath := repoPath + "/.git/aim-worktrees/" + safe

	cmd := exec.Command("git", "-C", repoPath, "worktree", "add", worktreePath, branch)
	out, err := cmd.CombinedOutput()
	if err != nil {
		cmd2 := exec.Command("git", "-C", repoPath, "worktree", "add", "-b", branch, worktreePath)
		out2, err2 := cmd2.CombinedOutput()
		if err2 != nil {
			return "", fmt.Errorf("git worktree add failed: %s\n%s", string(out), string(out2))
		}
	}
	return worktreePath, nil
}

func (m *Manager) ListWorktrees(repoPath string) ([]WorktreeInfo, error) {
	cmd := exec.Command("git", "-C", repoPath, "worktree", "list", "--porcelain")
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git worktree list: %w", err)
	}
	return parseWorktreeList(string(out)), nil
}

func (m *Manager) RemoveWorktree(repoPath string, worktreePath string) error {
	cmd := exec.Command("git", "-C", repoPath, "worktree", "remove", "--force", worktreePath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git worktree remove: %s", string(out))
	}
	return nil
}

// ParseRepoURL is the exported method bound to Wails.
func (m *Manager) ParseRepoURL(rawURL string) (RepoURL, error) {
	return ParseRepoURL(rawURL)
}

// ParseRepoURL is the package-level helper (also used by workspace manager).
func ParseRepoURL(rawURL string) (RepoURL, error) {
	rawURL = strings.TrimSpace(rawURL)

	// Handle SSH format: git@github.com:org/repo.git
	if strings.HasPrefix(rawURL, "git@") {
		withoutPrefix := strings.TrimPrefix(rawURL, "git@")
		parts := strings.SplitN(withoutPrefix, ":", 2)
		if len(parts) != 2 {
			return RepoURL{}, fmt.Errorf("invalid SSH URL: %s", rawURL)
		}
		host := parts[0]
		path := strings.TrimSuffix(parts[1], ".git")
		pathParts := strings.SplitN(path, "/", 2)
		if len(pathParts) != 2 {
			return RepoURL{}, fmt.Errorf("invalid SSH URL path: %s", rawURL)
		}
		return RepoURL{Host: host, Org: pathParts[0], Repo: pathParts[1]}, nil
	}

	// Handle HTTPS format: https://github.com/org/repo.git
	u, err := url.Parse(rawURL)
	if err != nil {
		return RepoURL{}, fmt.Errorf("invalid URL: %w", err)
	}
	path := strings.TrimPrefix(u.Path, "/")
	path = strings.TrimSuffix(path, ".git")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) != 2 {
		return RepoURL{}, fmt.Errorf("URL must include org/repo path: %s", rawURL)
	}
	return RepoURL{Host: u.Host, Org: parts[0], Repo: parts[1]}, nil
}

// CloneRepo runs git clone <url> <destPath>.
func (m *Manager) CloneRepo(repoURL string, destPath string) error {
	cmd := exec.Command("git", "clone", "--progress", repoURL, destPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git clone failed: %s", string(out))
	}
	return nil
}

// CloneDestPath returns the expected destination for a URL given a base dir.
func (m *Manager) CloneDestPath(repoURL string, baseDir string) (string, error) {
	parsed, err := ParseRepoURL(repoURL)
	if err != nil {
		return "", err
	}
	return filepath.Join(baseDir, parsed.Org, parsed.Repo), nil
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
