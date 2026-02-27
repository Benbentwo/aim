# Workspaces + Clone from URL — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor aim from a flat session list to a workspace-first model where each repository is a workspace containing one or more sessions, and add "Clone from URL" support that lands repos at `~/.aim/repos/<org>/<repo>`.

**Architecture:** A new `backend/workspace/manager.go` owns workspace CRUD and is the source of truth for what repos are registered. Sessions gain a `WorkspaceID` field. The frontend Zustand store gains a `workspaces` array; the sidebar is rewritten to render the expand/collapse hierarchy. The `AddRepositoryDialog` replaces `NewSessionDialog` with Open-Project and Clone-from-URL tabs.

**Tech Stack:** Go 1.23, Wails v2, `github.com/creack/pty`, React 18, TypeScript, Zustand, TailwindCSS v4, xterm.js.

---

## Reference

- Design doc: `docs/plans/2026-02-26-workspaces-and-clone-design.md`
- Existing session manager: `backend/session/manager.go`
- Existing worktree manager: `backend/worktree/manager.go`
- Existing settings manager: `backend/settings/manager.go`
- Existing sidebar: `frontend/src/components/Sidebar.tsx`
- Existing store: `frontend/src/stores/sessions.ts`

---

## Task 1: Add `WorkspaceID` to session backend

**Files:**
- Modify: `backend/session/manager.go`

**Step 1:** Add `WorkspaceID` to `SessionConfig` and `SessionState` structs.

In `backend/session/manager.go`, update the two structs:

```go
type SessionConfig struct {
    Name         string `json:"name"`
    Agent        string `json:"agent"`
    Directory    string `json:"directory"`
    UseWorktree  bool   `json:"useWorktree"`
    WorktreePath string `json:"worktreePath"`
    Branch       string `json:"branch"`
    WorkspaceID  string `json:"workspaceId"` // ADD THIS
}

type SessionState struct {
    ID           string `json:"id"`
    WorkspaceID  string `json:"workspaceId"` // ADD THIS
    Name         string `json:"name"`
    Agent        string `json:"agent"`
    Directory    string `json:"directory"`
    WorktreePath string `json:"worktreePath"`
    Branch       string `json:"branch"`
    Status       string `json:"status"`
}
```

**Step 2:** Update `persist()` and `loadPersistedSessions()` to carry `WorkspaceID` through. In `persist()`:

```go
sessions = append(sessions, SessionState{
    ID:           id,
    WorkspaceID:  s.Config.WorkspaceID, // ADD THIS
    Name:         s.Config.Name,
    // ... rest unchanged
})
```

In `loadPersistedSessions()`, inside the loop:

```go
m.sessions[ss.ID] = &Session{
    ID: ss.ID,
    Config: SessionConfig{
        WorkspaceID:  ss.WorkspaceID, // ADD THIS
        Name:         ss.Name,
        // ... rest unchanged
    },
    WorkDir: workDir,
}
```

**Step 3:** Verify Go compiles:

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim
go build ./...
```
Expected: no output (clean).

**Step 4:** Commit.

```bash
git add backend/session/manager.go
git commit -m "feat(session): add WorkspaceID to SessionConfig and SessionState"
```

---

## Task 2: Add `ReposBaseDir` to settings

**Files:**
- Modify: `backend/settings/manager.go`

**Step 1:** Add the field to the `Settings` struct and update `defaults()`:

```go
type Settings struct {
    DefaultAgent    string `json:"defaultAgent"`
    DefaultWorktree bool   `json:"defaultWorktree"`
    Theme           string `json:"theme"`
    ShellPath       string `json:"shellPath"`
    ReposBaseDir    string `json:"reposBaseDir"` // ADD THIS
}

func (m *Manager) defaults() Settings {
    shell := os.Getenv("SHELL")
    if shell == "" {
        shell = "/bin/zsh"
    }
    home, _ := os.UserHomeDir()
    return Settings{
        DefaultAgent:    "claude",
        DefaultWorktree: true,
        Theme:           "dark",
        ShellPath:       shell,
        ReposBaseDir:    filepath.Join(home, ".aim", "repos"), // ADD THIS
    }
}
```

**Step 2:** `go build ./...` — must pass.

**Step 3:** Commit.

```bash
git add backend/settings/manager.go
git commit -m "feat(settings): add ReposBaseDir setting (default ~/.aim/repos)"
```

---

## Task 3: Add `CloneRepo` and `ParseRepoURL` to worktree manager

**Files:**
- Modify: `backend/worktree/manager.go`

**Step 1:** Add the two functions. Replace the entire file with:

```go
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

// ParseRepoURL parses an https:// or git@host:org/repo.git URL into components.
func (m *Manager) ParseRepoURL(rawURL string) (RepoURL, error) {
    return ParseRepoURL(rawURL)
}

// ParseRepoURL is the package-level helper (also used by workspace manager).
func ParseRepoURL(rawURL string) (RepoURL, error) {
    rawURL = strings.TrimSpace(rawURL)

    // Handle SSH format: git@github.com:org/repo.git
    if strings.HasPrefix(rawURL, "git@") {
        // git@github.com:org/repo.git
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

// CloneRepo runs git clone <url> <destPath>. Streams progress via PTY events.
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
```

**Step 2:** `go build ./...` — must pass.

**Step 3:** Commit.

```bash
git add backend/worktree/manager.go
git commit -m "feat(worktree): add CloneRepo, ParseRepoURL, CloneDestPath"
```

---

## Task 4: Create `backend/workspace/manager.go`

**Files:**
- Create: `backend/workspace/manager.go`

**Step 1:** Create the directory and file:

```bash
mkdir -p /Users/bensmith/dev/src/github.com/Benbentwo/aim/backend/workspace
```

**Step 2:** Write the file:

```go
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
    // For local directory mode:
    Path string `json:"path"`
    // For clone mode (Path will be set by backend after clone):
    RepoURL     string `json:"repoUrl"`
    ReposBaseDir string `json:"reposBaseDir"`
    // Common:
    Name  string `json:"name"`
    Agent string `json:"agent"`
}

type Manager struct {
    mu             sync.RWMutex
    ctx            context.Context
    workspaces     map[string]*Workspace
    confPath       string
    sessionManager *session.Manager
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
    ws, err := m.AddWorkspace(config)
    if err != nil {
        return "", err
    }

    // Mark as cloned
    m.mu.Lock()
    if w, ok := m.workspaces[ws]; ok {
        w.Cloned = true
    }
    m.mu.Unlock()
    m.save()

    return ws, nil
}

// ListWorkspaces returns all workspaces with their sessions.
func (m *Manager) ListWorkspaces() []WorkspaceWithSessions {
    m.mu.RLock()
    defer m.mu.RUnlock()

    allSessions := m.sessionManager.ListSessions()
    // Index sessions by workspace ID
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
```

**Step 3:** `go build ./...` — must pass.

**Step 4:** Commit.

```bash
git add backend/workspace/
git commit -m "feat(workspace): add workspace manager with AddWorkspace and CloneAndAddWorkspace"
```

---

## Task 5: Wire workspace manager into `app.go` and `main.go`

**Files:**
- Modify: `app.go`
- Modify: `main.go`

**Step 1:** Update `app.go` — add `WorkspaceManager` field and wire it:

```go
package main

import (
    "context"

    "github.com/Benbentwo/aim/backend/session"
    "github.com/Benbentwo/aim/backend/settings"
    "github.com/Benbentwo/aim/backend/worktree"
    "github.com/Benbentwo/aim/backend/workspace"
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
    ctx              context.Context
    SessionManager   *session.Manager
    WorktreeManager  *worktree.Manager
    SettingsManager  *settings.Manager
    WorkspaceManager *workspace.Manager
}

func NewApp() *App {
    sessMgr := session.NewManager()
    wtrMgr := worktree.NewManager()
    return &App{
        SessionManager:   sessMgr,
        WorktreeManager:  wtrMgr,
        SettingsManager:  settings.NewManager(),
        WorkspaceManager: workspace.NewManager(sessMgr, wtrMgr),
    }
}

func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    a.SessionManager.SetContext(ctx)
    a.WorktreeManager.SetContext(ctx)
    a.SettingsManager.SetContext(ctx)
    a.WorkspaceManager.SetContext(ctx)
}

func (a *App) shutdown(ctx context.Context) {
    a.SessionManager.Shutdown()
}

func (a *App) OpenDirectoryDialog(title string) string {
    path, _ := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
        Title:                title,
        CanCreateDirectories: true,
    })
    return path
}
```

**Step 2:** Update `main.go` — add `WorkspaceManager` to the `Bind` slice:

```go
Bind: []interface{}{
    app,
    app.SessionManager,
    app.WorktreeManager,
    app.SettingsManager,
    app.WorkspaceManager, // ADD THIS
},
```

**Step 3:** `go build ./...` — must pass.

**Step 4:** Commit.

```bash
git add app.go main.go
git commit -m "feat: wire WorkspaceManager into Wails app"
```

---

## Task 6: Add Wails JS binding stubs for workspace manager

**Files:**
- Create: `frontend/wailsjs/go/workspace/Manager.js`
- Create: `frontend/wailsjs/go/workspace/Manager.d.ts`
- Modify: `frontend/wailsjs/go/worktree/Manager.js`
- Modify: `frontend/wailsjs/go/worktree/Manager.d.ts`

**Step 1:** Create `frontend/wailsjs/go/workspace/Manager.js`:

```js
// @ts-check
// This file is automatically generated. DO NOT EDIT

export function AddWorkspace(arg1) {
    return window['go']['workspace']['Manager']['AddWorkspace'](arg1);
}

export function CloneAndAddWorkspace(arg1) {
    return window['go']['workspace']['Manager']['CloneAndAddWorkspace'](arg1);
}

export function ListWorkspaces() {
    return window['go']['workspace']['Manager']['ListWorkspaces']();
}

export function RemoveWorkspace(arg1) {
    return window['go']['workspace']['Manager']['RemoveWorkspace'](arg1);
}

export function CloneDestPreview(arg1, arg2) {
    return window['go']['workspace']['Manager']['CloneDestPreview'](arg1, arg2);
}
```

**Step 2:** Create `frontend/wailsjs/go/workspace/Manager.d.ts`:

```ts
export interface Workspace {
  id: string;
  name: string;
  path: string;
  agent: string;
  cloned: boolean;
}

export interface WorkspaceWithSessions {
  id: string;
  name: string;
  path: string;
  agent: string;
  cloned: boolean;
  sessions: import('../session/Manager').SessionState[];
}

export interface AddWorkspaceConfig {
  path?: string;
  repoUrl?: string;
  reposBaseDir?: string;
  name?: string;
  agent?: string;
}

export function AddWorkspace(config: AddWorkspaceConfig): Promise<string>;
export function CloneAndAddWorkspace(config: AddWorkspaceConfig): Promise<string>;
export function ListWorkspaces(): Promise<WorkspaceWithSessions[]>;
export function RemoveWorkspace(id: string): Promise<void>;
export function CloneDestPreview(repoURL: string, reposBaseDir: string): Promise<string>;
```

**Step 3:** Add `CloneDestPath` binding to `frontend/wailsjs/go/worktree/Manager.js` (append):

```js
export function CloneDestPath(arg1, arg2) {
    return window['go']['worktree']['Manager']['CloneDestPath'](arg1, arg2);
}

export function CloneRepo(arg1, arg2) {
    return window['go']['worktree']['Manager']['CloneRepo'](arg1, arg2);
}
```

**Step 4:** Add types to `frontend/wailsjs/go/worktree/Manager.d.ts` (append):

```ts
export interface RepoURL {
  host: string;
  org: string;
  repo: string;
}

export function CloneDestPath(repoURL: string, baseDir: string): Promise<string>;
export function CloneRepo(repoURL: string, destPath: string): Promise<void>;
```

**Step 5:** `npm run build` from `frontend/` — TypeScript must pass.

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim/frontend && npm run build
```

**Step 6:** Commit.

```bash
git add frontend/wailsjs/go/workspace/ frontend/wailsjs/go/worktree/
git commit -m "feat(bindings): add workspace manager JS bindings; extend worktree bindings"
```

---

## Task 7: Update Zustand store to workspace model

**Files:**
- Modify: `frontend/src/stores/sessions.ts`

**Step 1:** Replace the entire file:

```ts
import { create } from 'zustand'

export type AgentType = 'claude' | 'codex' | 'shell'
export type SessionStatus = 'idle' | 'thinking' | 'waiting' | 'stopped' | 'errored'

export interface SessionState {
  id: string
  workspaceId: string
  name: string
  agent: AgentType
  directory: string
  worktreePath: string
  branch: string
  status: SessionStatus
}

export interface WorkspaceState {
  id: string
  name: string
  path: string
  agent: AgentType
  cloned: boolean
  expanded: boolean       // UI state only
  sessions: SessionState[]
}

interface AimStore {
  workspaces: WorkspaceState[]
  activeSessionId: string | null
  activeWorkspaceId: string | null

  // Workspace actions
  setWorkspaces: (workspaces: WorkspaceState[]) => void
  addWorkspace: (workspace: WorkspaceState) => void
  removeWorkspace: (id: string) => void
  toggleWorkspace: (id: string) => void

  // Session actions
  addSession: (session: SessionState) => void
  removeSession: (id: string) => void
  updateStatus: (id: string, status: SessionStatus) => void
  setActiveSession: (sessionId: string | null, workspaceId: string | null) => void
}

export const useAimStore = create<AimStore>((set) => ({
  workspaces: [],
  activeSessionId: null,
  activeWorkspaceId: null,

  setWorkspaces: (workspaces) => set({ workspaces }),

  addWorkspace: (workspace) =>
    set((state) => ({
      workspaces: [...state.workspaces, workspace],
    })),

  removeWorkspace: (id) =>
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId,
      activeSessionId: state.workspaces
        .find((w) => w.id === id)
        ?.sessions.some((s) => s.id === state.activeSessionId)
        ? null
        : state.activeSessionId,
    })),

  toggleWorkspace: (id) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...w, expanded: !w.expanded } : w
      ),
    })),

  addSession: (session) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === session.workspaceId
          ? { ...w, sessions: [...w.sessions, session] }
          : w
      ),
      activeSessionId: session.id,
      activeWorkspaceId: session.workspaceId,
    })),

  removeSession: (id) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) => ({
        ...w,
        sessions: w.sessions.filter((s) => s.id !== id),
      })),
      activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
    })),

  updateStatus: (id, status) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) =>
          s.id === id ? { ...s, status } : s
        ),
      })),
    })),

  setActiveSession: (sessionId, workspaceId) =>
    set({ activeSessionId: sessionId, activeWorkspaceId: workspaceId }),
}))
```

**Step 2:** `npm run build` — TypeScript must pass.

**Step 3:** Commit.

```bash
git add frontend/src/stores/sessions.ts
git commit -m "feat(store): refactor to workspace-first Zustand model"
```

---

## Task 8: Rewrite `Sidebar.tsx` for workspace hierarchy

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

**Step 1:** Replace the entire file:

```tsx
import { useAimStore, WorkspaceState, SessionState, SessionStatus } from '../stores/sessions'

interface SidebarProps {
  onAddRepository: () => void
  onSettings: () => void
  onNewSession: (workspaceId: string) => void
}

const statusColors: Record<SessionStatus, string> = {
  idle:     'bg-emerald-400',
  thinking: 'bg-yellow-400 animate-pulse',
  waiting:  'bg-orange-400 animate-pulse',
  stopped:  'bg-slate-500',
  errored:  'bg-red-500',
}

const agentBadge: Record<string, string> = {
  claude: 'bg-indigo-800 text-indigo-200',
  codex:  'bg-green-800 text-green-200',
  shell:  'bg-slate-700 text-slate-300',
}

function StatusDot({ status }: { status: SessionStatus }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColors[status] ?? 'bg-slate-500'}`} />
  )
}

function SessionRow({ session, isActive, onClick }: {
  session: SessionState
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-left rounded-md transition-colors text-xs ${
        isActive
          ? 'bg-slate-700 text-white'
          : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
      }`}
    >
      <StatusDot status={session.status} />
      <span className="flex-1 truncate font-mono">{session.branch || session.name}</span>
      <span className={`text-[10px] ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>
        {session.status === 'thinking' ? '…' : session.status === 'stopped' ? '■' : ''}
      </span>
    </button>
  )
}

function WorkspaceRow({ workspace, isActiveWs, activeSessionId, onSessionClick, onNewSession }: {
  workspace: WorkspaceState
  isActiveWs: boolean
  activeSessionId: string | null
  onSessionClick: (sessionId: string, workspaceId: string) => void
  onNewSession: (workspaceId: string) => void
}) {
  const { toggleWorkspace } = useAimStore()
  const anyThinking = workspace.sessions.some((s) => s.status === 'thinking' || s.status === 'waiting')

  return (
    <div>
      {/* Workspace header row */}
      <button
        onClick={() => toggleWorkspace(workspace.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors group ${
          isActiveWs && !workspace.expanded
            ? 'bg-slate-700 text-white'
            : 'text-slate-300 hover:bg-slate-800'
        }`}
      >
        {/* Chevron */}
        <span className={`text-slate-500 transition-transform text-xs ${workspace.expanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
        <span className="flex-1 text-sm font-medium truncate">{workspace.name}</span>
        {anyThinking && (
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${agentBadge[workspace.agent] ?? agentBadge.shell}`}>
          {workspace.agent}
        </span>
      </button>

      {/* Sessions (visible when expanded) */}
      {workspace.expanded && (
        <div className="mt-0.5 space-y-0.5">
          {workspace.sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onClick={() => onSessionClick(s.id, workspace.id)}
            />
          ))}
          {/* + New session */}
          <button
            onClick={() => onNewSession(workspace.id)}
            className="w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-xs text-slate-600 hover:text-indigo-400 hover:bg-slate-800 rounded-md transition-colors"
          >
            <span>+</span>
            <span>New session</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ onAddRepository, onSettings, onNewSession }: SidebarProps) {
  const { workspaces, activeSessionId, activeWorkspaceId, setActiveSession } = useAimStore()

  const handleSessionClick = (sessionId: string, workspaceId: string) => {
    setActiveSession(sessionId, workspaceId)
  }

  return (
    <div className="flex flex-col w-60 shrink-0 bg-[#131620] border-r border-slate-800 pt-10 no-select">
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {workspaces.map((ws) => (
          <WorkspaceRow
            key={ws.id}
            workspace={ws}
            isActiveWs={ws.id === activeWorkspaceId}
            activeSessionId={activeSessionId}
            onSessionClick={handleSessionClick}
            onNewSession={onNewSession}
          />
        ))}
        {workspaces.length === 0 && (
          <p className="text-xs text-slate-600 text-center mt-8 px-3">
            No repositories yet.
          </p>
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-3 py-3 border-t border-slate-800 space-y-1">
        <button
          onClick={onAddRepository}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span>Add repository</span>
        </button>
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}
```

**Step 2:** `npm run build` — must pass.

**Step 3:** Commit.

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat(sidebar): rewrite for workspace-session hierarchy with expand/collapse"
```

---

## Task 9: Create `AddRepositoryDialog.tsx`

**Files:**
- Create: `frontend/src/components/AddRepositoryDialog.tsx`

**Step 1:** Create the file with Open Project + Clone from URL tabs:

```tsx
import { useState, useEffect, useRef } from 'react'
import { useAimStore, AgentType, SessionState } from '../stores/sessions'

type Tab = 'open' | 'clone'

const agents: { id: AgentType; label: string }[] = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'OpenAI Codex' },
  { id: 'shell', label: 'Shell' },
]

interface AddRepositoryDialogProps {
  onClose: () => void
}

export default function AddRepositoryDialog({ onClose }: AddRepositoryDialogProps) {
  const { addWorkspace } = useAimStore()
  const [tab, setTab] = useState<Tab>('open')
  const [agent, setAgent] = useState<AgentType>('claude')

  // Open tab state
  const [localPath, setLocalPath] = useState('')
  const [openName, setOpenName] = useState('')

  // Clone tab state
  const [repoUrl, setRepoUrl] = useState('')
  const [cloneName, setCloneName] = useState('')
  const [cloneDest, setCloneDest] = useState('')
  const [reposBaseDir, setReposBaseDir] = useState('~/.aim/repos')

  const [loading, setLoading] = useState(false)
  const [cloneProgress, setCloneProgress] = useState('')
  const [error, setError] = useState('')

  // Load reposBaseDir from settings
  useEffect(() => {
    import('../../wailsjs/go/settings/Manager')
      .then(({ GetSettings }) => GetSettings())
      .then((s: any) => {
        if (s.reposBaseDir) setReposBaseDir(s.reposBaseDir)
        if (s.defaultAgent) setAgent(s.defaultAgent)
      })
      .catch(() => {})
  }, [])

  // Auto-preview clone destination as user types URL
  useEffect(() => {
    if (!repoUrl.trim() || !reposBaseDir) {
      setCloneDest('')
      setCloneName('')
      return
    }
    const timer = setTimeout(() => {
      import('../../wailsjs/go/workspace/Manager')
        .then(({ CloneDestPreview }) => CloneDestPreview(repoUrl.trim(), reposBaseDir))
        .then((dest: string) => {
          setCloneDest(dest)
          // Auto-fill name from last path segment
          const parts = dest.split('/')
          setCloneName((n) => n || parts[parts.length - 1] || '')
        })
        .catch(() => {
          setCloneDest('')
        })
    }, 400) // debounce
    return () => clearTimeout(timer)
  }, [repoUrl, reposBaseDir])

  const handleBrowse = async () => {
    try {
      const { OpenDirectoryDialog } = await import('../../wailsjs/go/main/App')
      const path = await OpenDirectoryDialog('Select project directory')
      if (path) {
        setLocalPath(path)
        if (!openName) {
          const parts = path.split('/')
          setOpenName(parts[parts.length - 1] || '')
        }
      }
    } catch {
      setError('Could not open directory picker')
    }
  }

  const handleCreate = async () => {
    setError('')
    setLoading(true)

    try {
      const { AddWorkspace, CloneAndAddWorkspace, ListWorkspaces } =
        await import('../../wailsjs/go/workspace/Manager')

      let workspaceId: string

      if (tab === 'open') {
        if (!localPath) throw new Error('Select a directory')
        workspaceId = await AddWorkspace({
          path: localPath,
          name: openName || undefined,
          agent,
        })
      } else {
        if (!repoUrl.trim()) throw new Error('Enter a Git URL')
        setCloneProgress('Cloning repository…')
        workspaceId = await CloneAndAddWorkspace({
          repoUrl: repoUrl.trim(),
          reposBaseDir,
          name: cloneName || undefined,
          agent,
        })
        setCloneProgress('')
      }

      // Fetch updated workspace list and update store
      const workspaces = await ListWorkspaces()
      const ws = workspaces.find((w: any) => w.id === workspaceId)
      if (ws) {
        addWorkspace({
          id: ws.id,
          name: ws.name,
          path: ws.path,
          agent: ws.agent as AgentType,
          cloned: ws.cloned,
          expanded: true,
          sessions: (ws.sessions ?? []).map((s: any): SessionState => ({
            id: s.id,
            workspaceId: ws.id,
            name: s.name,
            agent: s.agent as AgentType,
            directory: s.directory,
            worktreePath: s.worktreePath ?? '',
            branch: s.branch ?? '',
            status: s.status ?? 'idle',
          })),
        })
      }

      onClose()
    } catch (err: any) {
      setCloneProgress('')
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1e2e] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-white mb-5">Add Repository</h2>

        {/* Tab picker */}
        <div className="flex gap-1 p-1 bg-slate-800 rounded-lg mb-5">
          {(['open', 'clone'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'open' ? 'Open Project' : 'Clone from URL'}
            </button>
          ))}
        </div>

        {/* Agent picker */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Agent</label>
          <div className="grid grid-cols-3 gap-2">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => setAgent(a.id)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  agent === a.id
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'open' ? (
          <>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="/path/to/project"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleBrowse}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  Browse
                </button>
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Name</label>
              <input
                type="text"
                value={openName}
                onChange={(e) => setOpenName(e.target.value)}
                placeholder="my-project"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Git URL</label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            {cloneDest && (
              <div className="mb-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Cloning to:</p>
                <p className="text-xs text-slate-300 font-mono break-all">{cloneDest}</p>
              </div>
            )}
            <div className="mb-5">
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Name</label>
              <input
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="my-repo"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </>
        )}

        {cloneProgress && (
          <div className="flex items-center gap-2 mb-4 text-sm text-indigo-400">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.2"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            {cloneProgress}
          </div>
        )}

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Adding…' : tab === 'clone' ? 'Clone & Open' : 'Open'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2:** `npm run build` — must pass.

**Step 3:** Commit.

```bash
git add frontend/src/components/AddRepositoryDialog.tsx
git commit -m "feat(ui): add AddRepositoryDialog with Open Project and Clone from URL tabs"
```

---

## Task 10: Create `NewWorktreeSessionDialog.tsx`

**Files:**
- Create: `frontend/src/components/NewWorktreeSessionDialog.tsx`

**Step 1:** Create the lightweight dialog for adding a new worktree session to an existing workspace:

```tsx
import { useState } from 'react'
import { useAimStore, AgentType, SessionState } from '../stores/sessions'

interface NewWorktreeSessionDialogProps {
  workspaceId: string
  workspacePath: string
  workspaceAgent: AgentType
  onClose: () => void
}

export default function NewWorktreeSessionDialog({
  workspaceId,
  workspacePath,
  workspaceAgent,
  onClose,
}: NewWorktreeSessionDialogProps) {
  const { addSession } = useAimStore()
  const [branch, setBranch] = useState('aim/')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!branch.trim()) { setError('Enter a branch name'); return }
    const sessionName = name.trim() || branch.trim()
    setLoading(true)
    setError('')

    try {
      const { CreateWorktree } = await import('../../wailsjs/go/worktree/Manager')
      const worktreePath = await CreateWorktree(workspacePath, branch.trim())

      const { CreateSession } = await import('../../wailsjs/go/session/Manager')
      const id = await CreateSession({
        name: sessionName,
        agent: workspaceAgent,
        directory: workspacePath,
        useWorktree: true,
        worktreePath,
        branch: branch.trim(),
        workspaceId,
      })

      addSession({
        id,
        workspaceId,
        name: sessionName,
        agent: workspaceAgent,
        directory: workspacePath,
        worktreePath,
        branch: branch.trim(),
        status: 'idle',
      })

      onClose()
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1e2e] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-white mb-4">New Session</h2>
        <p className="text-xs text-slate-500 font-mono mb-4 truncate">{workspacePath}</p>

        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Branch</label>
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="aim/feature-name"
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
            Session name <span className="text-slate-600">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={branch || 'my-session'}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Creating…' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2:** `npm run build` — must pass.

**Step 3:** Commit.

```bash
git add frontend/src/components/NewWorktreeSessionDialog.tsx
git commit -m "feat(ui): add NewWorktreeSessionDialog for in-workspace worktree sessions"
```

---

## Task 11: Update `SessionHeader.tsx` for workspace model

**Files:**
- Modify: `frontend/src/components/SessionHeader.tsx`

**Step 1:** The `session` prop type needs to reference the new `SessionState` from the updated store (which now has `workspaceId`). Update the import:

```tsx
import { SessionState, SessionStatus, useAimStore } from '../stores/sessions'
```

Change `removeSession` to `removeSession` from `useAimStore` (same call, just confirming the import path is right). No other logic changes needed — the component works as-is with the new store shape.

**Step 2:** `npm run build` — must pass.

**Step 3:** Commit.

```bash
git add frontend/src/components/SessionHeader.tsx
git commit -m "fix(SessionHeader): update store import for workspace model"
```

---

## Task 12: Update `App.tsx` to wire workspace model

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1:** Replace the entire file:

```tsx
import { useEffect, useState } from 'react'
import './style.css'
import Sidebar from './components/Sidebar'
import Terminal from './components/Terminal'
import SessionHeader from './components/SessionHeader'
import AddRepositoryDialog from './components/AddRepositoryDialog'
import NewWorktreeSessionDialog from './components/NewWorktreeSessionDialog'
import SettingsDialog from './components/Settings'
import { useAimStore, AgentType, SessionState, WorkspaceState } from './stores/sessions'

declare const window: Window & {
  runtime?: {
    EventsOn: (event: string, callback: (...args: unknown[]) => void) => void
    EventsOff: (event: string) => void
  }
}

function App() {
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [newSessionWorkspace, setNewSessionWorkspace] = useState<WorkspaceState | null>(null)

  const {
    workspaces,
    activeSessionId,
    activeWorkspaceId,
    setWorkspaces,
    updateStatus,
  } = useAimStore()

  // Flatten all sessions for lookup
  const allSessions = workspaces.flatMap((w) => w.sessions)
  const activeSession = allSessions.find((s) => s.id === activeSessionId) ?? null
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null

  // Load workspaces from backend on mount
  useEffect(() => {
    import('../wailsjs/go/workspace/Manager')
      .then(({ ListWorkspaces }) => ListWorkspaces())
      .then((list: any[]) => {
        if (!list || list.length === 0) return
        const mapped: WorkspaceState[] = list.map((ws) => ({
          id: ws.id,
          name: ws.name,
          path: ws.path,
          agent: ws.agent as AgentType,
          cloned: ws.cloned ?? false,
          expanded: ws.sessions?.length > 0,
          sessions: (ws.sessions ?? []).map((s: any): SessionState => ({
            id: s.id,
            workspaceId: ws.id,
            name: s.name,
            agent: s.agent as AgentType,
            directory: s.directory,
            worktreePath: s.worktreePath ?? '',
            branch: s.branch ?? '',
            status: 'stopped',
          })),
        }))
        setWorkspaces(mapped)
      })
      .catch(() => {})
  }, [setWorkspaces])

  // Subscribe to status events
  useEffect(() => {
    allSessions.forEach((s) => {
      window.runtime?.EventsOn(`session:status:${s.id}`, (status: unknown) => {
        updateStatus(s.id, status as any)
      })
    })
    return () => {
      allSessions.forEach((s) => {
        window.runtime?.EventsOff(`session:status:${s.id}`)
      })
    }
  }, [allSessions.length, updateStatus])

  const handleNewSession = (workspaceId: string) => {
    const ws = workspaces.find((w) => w.id === workspaceId)
    if (ws) setNewSessionWorkspace(ws)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f1117]">
      <Sidebar
        onAddRepository={() => setShowAddRepo(true)}
        onSettings={() => setShowSettings(true)}
        onNewSession={handleNewSession}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {activeSession ? (
          <>
            <SessionHeader session={activeSession} />
            <div className="flex-1 min-h-0">
              <Terminal sessionId={activeSession.id} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-slate-500 select-none">
            <div className="text-center">
              <p className="text-2xl font-semibold text-slate-400 mb-2">aim</p>
              <p className="text-sm">AI Manager — multi-session terminal for Claude Code &amp; Codex</p>
              <button
                className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                onClick={() => setShowAddRepo(true)}
              >
                + Add repository
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddRepo && <AddRepositoryDialog onClose={() => setShowAddRepo(false)} />}

      {newSessionWorkspace && (
        <NewWorktreeSessionDialog
          workspaceId={newSessionWorkspace.id}
          workspacePath={newSessionWorkspace.path}
          workspaceAgent={newSessionWorkspace.agent}
          onClose={() => setNewSessionWorkspace(null)}
        />
      )}

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
```

**Step 2:** `npm run build` — TypeScript must pass with no errors.

**Step 3:** Full build verification:

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim
go build ./...
cd frontend && npm run build
```

Both must pass.

**Step 4:** Commit.

```bash
git add frontend/src/App.tsx
git commit -m "feat(app): wire workspace model into App — AddRepository, NewWorktreeSession dialogs"
```

---

## Task 13: Clean up `NewSessionDialog.tsx`

**Files:**
- Delete (or keep for reference): `frontend/src/components/NewSessionDialog.tsx`

`NewSessionDialog.tsx` has been superseded by `AddRepositoryDialog.tsx` and `NewWorktreeSessionDialog.tsx`. Nothing imports it anymore after Task 12.

**Step 1:** Delete it:

```bash
rm /Users/bensmith/dev/src/github.com/Benbentwo/aim/frontend/src/components/NewSessionDialog.tsx
```

**Step 2:** `npm run build` — must still pass.

**Step 3:** Commit.

```bash
git add -A
git commit -m "chore: remove superseded NewSessionDialog.tsx"
```

---

## Verification Checklist

After all tasks complete, verify:

1. `go build ./...` — clean
2. `cd frontend && npm run build` — clean, no TS errors
3. `wails dev` launches the app
4. Empty state shows "Add repository" button in center
5. Add repository → Open Project → browse to a git repo → creates workspace with session in sidebar
6. Sidebar shows workspace row with expand/collapse chevron
7. Clicking workspace row expands to show session sub-rows
8. Add repository → Clone from URL → type `https://github.com/wailsapp/wails` → destination preview shows `~/.aim/repos/wailsapp/wails`
9. `[+ New session]` inside an expanded workspace opens `NewWorktreeSessionDialog`
10. Settings icon at bottom opens settings
