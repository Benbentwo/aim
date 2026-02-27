# Workspaces + Clone from URL — Design

**Date:** 2026-02-26
**Status:** Approved

---

## Context

The initial `aim` implementation has a flat list of sessions. This design upgrades the architecture to a **workspace-first model** (inspired by Conductor) and adds a **Clone from URL** flow so users can start a new AI session directly from a Git URL without leaving the app.

---

## Goals

- Model each repository as a **Workspace**; sessions live inside workspaces.
- Each workspace can have multiple sessions, each on its own git worktree.
- Users can add a workspace by opening a local directory **or** cloning a Git URL.
- Cloned repos land in `~/.aim/repos/<org>/<repo>` by default (configurable).
- Sidebar shows workspaces with expand/collapse; sessions appear as sub-rows.

---

## Data Model

### Workspace

```go
type Workspace struct {
    ID     string `json:"id"`
    Name   string `json:"name"`
    Path   string `json:"path"`   // root dir on disk
    Agent  string `json:"agent"`  // default agent: "claude" | "codex" | "shell"
    Cloned bool   `json:"cloned"` // true if aim cloned this repo
}
```

### Session (updated)

```go
type Session struct {
    ID          string `json:"id"`
    WorkspaceID string `json:"workspaceId"`
    Name        string `json:"name"`
    WorktreePath string `json:"worktreePath"` // empty = workspace root
    Branch      string `json:"branch"`
    Status      string `json:"status"`
}
```

### Persistence

- `~/.config/aim/workspaces.json` — workspace list
- `~/.config/aim/sessions.json` — session list (now includes `workspaceId`)
- `~/.config/aim/sessions/<id>/scrollback.log` — unchanged

---

## Sidebar Layout

```
▼ aim           [claude]     ← workspace row (expanded)
    ● main        idle        ← session on repo root
    ◦ feat/login  thinking    ← session on worktree
    [+] New session

▶ varlyapp      [claude]     ← workspace row (collapsed)

[⊕] Add repository
[⚙] Settings
```

- **Workspace row:** chevron + repo name + default agent badge. Click = expand/collapse.
- **Session sub-row:** status dot + branch/name + status label.
- **[+ New session]:** visible when expanded; opens a lightweight "new worktree session" dialog (branch name + session name only — directory is inherited from workspace).
- **[⊕ Add repository]:** opens the full Add Repository dialog.
- **[⚙ Settings]:** opens settings panel.

---

## Add Repository Dialog

Two tabs at the top:

### Tab 1 — Open Project

| Field | Behaviour |
|---|---|
| Directory | Text input + Browse button (native dir picker) |
| Worktree toggle | Auto-checked when directory is a git repo |
| Session name | Auto-filled from directory basename |
| Agent | Picker: Claude Code / OpenAI Codex / Shell |

### Tab 2 — Clone from URL

| Field | Behaviour |
|---|---|
| Git URL | Text input; accepts `https://` or `git@` formats |
| Clone destination | Read-only, auto-derived as `<reposBaseDir>/<org>/<repo>`. Shows resolved path. |
| Session name | Auto-filled from repo name |
| Agent | Picker |

**Clone destination derivation:**
- Parse URL to extract host, org, repo name.
- Strip `.git` suffix.
- Result: `<reposBaseDir>/<org>/<repo>` (e.g. `~/.aim/repos/Benbentwo/aim`).
- `reposBaseDir` defaults to `~/.aim/repos`; configurable in Settings.

**On Create (Clone tab):**
1. Show inline progress: "Cloning…"
2. Run `git clone <url> <destPath>`.
3. On success: create Workspace record, create initial Session (no worktree), spawn PTY.
4. On failure: show error inline, keep dialog open.

---

## Backend Changes

### New: `backend/workspace/manager.go`

Wails-bound methods:
```go
AddWorkspace(config WorkspaceConfig) (string, error)  // returns workspace ID
ListWorkspaces() []WorkspaceWithSessions
RemoveWorkspace(id string) error
```

### Updated: `backend/worktree/manager.go`

Add:
```go
CloneRepo(url string, destPath string) error
ParseRepoURL(url string) (org string, repo string, err error)
```

### Updated: `backend/session/manager.go`

- `SessionConfig` gains `WorkspaceID string`.
- `CreateSession` no longer needs `Directory` directly — resolved via workspace.
- `ListSessions` returns sessions grouped or filterable by workspace.

### Updated: `backend/settings/manager.go`

Add field:
```go
ReposBaseDir string `json:"reposBaseDir"` // default: ~/.aim/repos
```

---

## Frontend Changes

| File | Change |
|---|---|
| `stores/sessions.ts` | Add `Workspace` type and `workspaces` array to store |
| `Sidebar.tsx` | Rewrite: workspace rows with expand/collapse, session sub-rows |
| `NewSessionDialog.tsx` | Replace with `AddRepositoryDialog.tsx` (Open / Clone tabs) |
| `NewWorktreeSessionDialog.tsx` | New lightweight dialog: branch + name only |
| `App.tsx` | Wire new workspace store, update Add Repository / New Session handlers |
| `wailsjs/go/workspace/Manager.*` | New binding stubs |

---

## Settings Updates

New setting: **Repos base directory** — default `~/.aim/repos`.
Shown in Settings screen under a new "Cloning" section.

---

## Out of Scope (v1)

- Export to Conductor
- Quick Start templates
- Multi-host support (GitHub Enterprise, GitLab, etc.) — URL parsing handles the path correctly already; SSH keys are the user's responsibility
- Drag-to-reorder workspaces
