# Session Archive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the permanent "close session" with a Conductor-style archive — sessions are hidden from the active sidebar, their worktrees are preserved, and they can be restored or deleted from a dedicated archive panel.

**Architecture:** Add an `archived` boolean + `archivedAt` timestamp to `SessionState` in `sessions.json`. The sidebar filters to non-archived sessions; a new `ArchivePanel` component lists all archived sessions across workspaces with Restore / Open in Finder / Delete actions. A configurable cleanup job removes stale worktrees on app startup.

**Tech Stack:** Go (Wails v2), React 18, TypeScript, Zustand, TailwindCSS. No test framework is set up; verification is `go build ./...` (Go) and `npm run build` (TypeScript). Run both after every Go or TS change.

---

## Task 1: Add `Archived`/`ArchivedAt` to Go data model + `RepoPath` to config

**Files:**
- Modify: `backend/session/manager.go`

The `SessionState` struct needs two new fields. The `SessionConfig` struct needs `RepoPath` so the archive cleanup job can call `git worktree remove` without deriving the main repo path heuristically.

**Step 1: Add fields to `SessionState`**

In `manager.go`, find the `SessionState` struct (line 44) and add after `Branch`:

```go
Archived   bool       `json:"archived,omitempty"`
ArchivedAt *time.Time `json:"archivedAt,omitempty"`
```

**Step 2: Add `RepoPath` to `SessionConfig`**

In the `SessionConfig` struct (line 26), add after `Branch`:

```go
RepoPath string `json:"repoPath"` // main git repo root (workspace path), empty for non-git
```

**Step 3: Update `loadPersistedSessions` to map the new fields**

In `loadPersistedSessions` (around line 94), inside the `SessionConfig` literal, add:

```go
RepoPath: ss.Config.RepoPath, // need to store it — see next sub-step
```

Wait — `loadPersistedSessions` reads `SessionState` but builds `SessionConfig`. `SessionState` doesn't currently have `RepoPath`. The cleanest fix: also add `RepoPath string \`json:"repoPath"\`` to `SessionState` (it will round-trip through `sessions.json`), and populate it in both `persist()` and `loadPersistedSessions`.

In `SessionState` struct, add:

```go
RepoPath string `json:"repoPath,omitempty"`
```

In `loadPersistedSessions`, inside the `SessionConfig{}` literal:

```go
RepoPath: ss.RepoPath,
```

In `persist()`, inside the `SessionState{}` literal:

```go
RepoPath: s.Config.RepoPath,
Archived: s.Config.Archived,  // not in Config yet — add below
```

Wait, `Archived` and `ArchivedAt` belong to `SessionState` not `SessionConfig` (they are persistence metadata, not session creation params). Keep them only on `SessionState`. The `Session` struct needs them too so the manager can check them at runtime.

Revised approach — add to `Session` struct (line 37):

```go
Archived   bool       `json:"archived,omitempty"`
ArchivedAt *time.Time `json:"archivedAt,omitempty"`
```

And in `persist()`, pull from the `Session` struct:

```go
Archived:   s.Archived,
ArchivedAt: s.ArchivedAt,
```

And in `loadPersistedSessions`, restore to the `Session` struct:

```go
m.sessions[ss.ID] = &Session{
    ID:         ss.ID,
    Archived:   ss.Archived,
    ArchivedAt: ss.ArchivedAt,
    Config: SessionConfig{
        ...
        RepoPath: ss.RepoPath,
    },
    WorkDir: workDir,
}
```

**Step 4: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim && go build ./...
```

Expected: no output (clean build).

**Step 5: Commit**

```bash
git add backend/session/manager.go
git commit -m "feat(session): add Archived/ArchivedAt to Session, RepoPath to SessionConfig"
```

---

## Task 2: Add `ArchiveWorktreeCleanupDays` to settings

**Files:**
- Modify: `backend/settings/manager.go`

**Step 1: Add field to `Settings` struct**

```go
ArchiveWorktreeCleanupDays int `json:"archiveWorktreeCleanupDays"`
```

**Step 2: Add to `defaults()`**

```go
ArchiveWorktreeCleanupDays: 7,
```

**Step 3: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim && go build ./...
```

**Step 4: Commit**

```bash
git add backend/settings/manager.go
git commit -m "feat(settings): add ArchiveWorktreeCleanupDays (default 7)"
```

---

## Task 3: Add `ArchiveSession` to session Manager

**Files:**
- Modify: `backend/session/manager.go`

**Step 1: Add the method**

Add after `CloseSession`:

```go
// ArchiveSession kills the PTY if running, marks the session archived, and persists.
// The worktree is left on disk.
func (m *Manager) ArchiveSession(id string) error {
	m.mu.Lock()
	ps, hasPTY := m.ptySessions[id]
	if hasPTY {
		delete(m.ptySessions, id)
	}
	s, ok := m.sessions[id]
	if ok {
		now := time.Now()
		s.Archived = true
		s.ArchivedAt = &now
	}
	m.mu.Unlock()

	if hasPTY {
		_ = ps.kill()
	}
	if !ok {
		return fmt.Errorf("session %s not found", id)
	}
	m.updateStatus(id, StatusStopped)
	m.persist()
	return nil
}
```

**Step 2: Add `time` to imports** if not already present (it is already imported in `pty.go` but `manager.go` is a separate file — check the imports block in `manager.go`). Add `"time"` to the import block.

**Step 3: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim && go build ./...
```

**Step 4: Commit**

```bash
git add backend/session/manager.go
git commit -m "feat(session): add ArchiveSession"
```

---

## Task 4: Add `UnarchiveSession` and `DeleteArchivedSession`

**Files:**
- Modify: `backend/session/manager.go`

**Step 1: Add `UnarchiveSession`**

```go
// UnarchiveSession clears the archived flag so the session reappears in the sidebar.
// It does NOT re-spawn the PTY — the frontend should show it as stopped.
func (m *Manager) UnarchiveSession(id string) error {
	m.mu.Lock()
	s, ok := m.sessions[id]
	if ok {
		s.Archived = false
		s.ArchivedAt = nil
	}
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("session %s not found", id)
	}
	m.persist()
	return nil
}
```

**Step 2: Add `DeleteArchivedSession`**

```go
// DeleteArchivedSession removes an archived session's metadata and scrollback log.
// The worktree is NOT removed — the user manages the branch via git.
func (m *Manager) DeleteArchivedSession(id string) error {
	m.mu.Lock()
	_, ok := m.sessions[id]
	if ok {
		delete(m.sessions, id)
		delete(m.statuses, id)
	}
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("session %s not found", id)
	}
	// Remove scrollback log directory
	dir := m.persister.sessionDir(id)
	_ = os.RemoveAll(dir)
	m.persist()
	return nil
}
```

**Step 3: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim && go build ./...
```

**Step 4: Commit**

```bash
git add backend/session/manager.go
git commit -m "feat(session): add UnarchiveSession and DeleteArchivedSession"
```

---

## Task 5: Add `cleanupStaleWorktrees` on app startup

**Files:**
- Modify: `backend/session/manager.go`
- Modify: `app.go` (wire settings manager into session manager for cleanup)

The session manager needs access to settings to read `ArchiveWorktreeCleanupDays`. The simplest approach is to read the settings file directly via `settings.NewManager()` in the cleanup function — no need to inject a settings manager reference.

**Step 1: Add `cleanupStaleWorktrees` to `manager.go`**

```go
// cleanupStaleWorktrees removes worktrees for sessions archived longer than
// the configured cleanup period. Called on startup.
func (m *Manager) cleanupStaleWorktrees() {
	// Import settings inline to avoid circular deps
	import_settings := func() int {
		confDir, _ := os.UserConfigDir()
		data, err := os.ReadFile(filepath.Join(confDir, "aim", "settings.json"))
		if err != nil {
			return 7 // default
		}
		var s struct {
			ArchiveWorktreeCleanupDays int `json:"archiveWorktreeCleanupDays"`
		}
		if err := json.Unmarshal(data, &s); err != nil || s.ArchiveWorktreeCleanupDays == 0 {
			return 0 // 0 = disabled
		}
		return s.ArchiveWorktreeCleanupDays
	}
	cleanupDays := import_settings()
	if cleanupDays == 0 {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	cutoff := time.Now().AddDate(0, 0, -cleanupDays)
	for _, s := range m.sessions {
		if !s.Archived || s.ArchivedAt == nil || s.ArchivedAt.After(cutoff) {
			continue
		}
		if s.Config.WorktreePath == "" {
			continue
		}
		repoPath := s.Config.RepoPath
		if repoPath == "" {
			continue
		}
		cmd := exec.Command("git", "-C", repoPath, "worktree", "remove", "--force", s.Config.WorktreePath)
		if err := cmd.Run(); err == nil {
			s.Config.WorktreePath = ""
		}
	}
	// persist is called after the lock — but we're holding it here. Call after unlock.
}
```

Note: the `import_settings` inner func pattern doesn't compile as Go. Use a proper helper approach instead — read the settings file inline without a nested func:

```go
func (m *Manager) cleanupStaleWorktrees() {
	confDir, _ := os.UserConfigDir()
	data, _ := os.ReadFile(filepath.Join(confDir, "aim", "settings.json"))
	var settingsData struct {
		ArchiveWorktreeCleanupDays int `json:"archiveWorktreeCleanupDays"`
	}
	if err := json.Unmarshal(data, &settingsData); err != nil {
		return // settings unreadable, skip cleanup
	}
	cleanupDays := settingsData.ArchiveWorktreeCleanupDays
	if cleanupDays == 0 {
		return
	}

	cutoff := time.Now().AddDate(0, 0, -cleanupDays)

	m.mu.Lock()
	var changed bool
	for _, s := range m.sessions {
		if !s.Archived || s.ArchivedAt == nil || s.ArchivedAt.After(cutoff) {
			continue
		}
		if s.Config.WorktreePath == "" || s.Config.RepoPath == "" {
			continue
		}
		cmd := exec.Command("git", "-C", s.Config.RepoPath, "worktree", "remove", "--force", s.Config.WorktreePath)
		if err := cmd.Run(); err == nil {
			s.Config.WorktreePath = ""
			changed = true
		}
	}
	m.mu.Unlock()

	if changed {
		m.persist()
	}
}
```

**Step 2: Add `"encoding/json"`, `"path/filepath"` to imports in manager.go** (if not already there; check the import block).

**Step 3: Call `cleanupStaleWorktrees` in `SetContext`**

In `SetContext` (line 74):

```go
func (m *Manager) SetContext(ctx context.Context) {
	m.ctx = ctx
	m.loadPersistedSessions()
	m.cleanupStaleWorktrees() // runs after sessions are loaded
}
```

**Step 4: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim && go build ./...
```

**Step 5: Commit**

```bash
git add backend/session/manager.go
git commit -m "feat(session): cleanup stale worktrees on startup per settings"
```

---

## Task 6: Update Wails bindings — session Manager

**Files:**
- Modify: `frontend/wailsjs/go/session/Manager.d.ts`
- Modify: `frontend/wailsjs/go/session/Manager.js`

These files are auto-generated by `wails dev` but we maintain them manually since we're not running the full Wails dev server. Keep the "DO NOT EDIT" comment — it's informational, not enforced.

**Step 1: Update `Manager.d.ts`**

Replace the file contents:

```typescript
// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT

export interface SessionConfig {
  name: string;
  agent: string;
  directory: string;
  useWorktree: boolean;
  worktreePath: string;
  branch: string;
  workspaceId: string;
  repoPath: string;
}

export interface SessionState {
  id: string;
  workspaceId: string;
  name: string;
  agent: string;
  directory: string;
  worktreePath: string;
  repoPath: string;
  branch: string;
  status: string;
  archived: boolean;
  archivedAt?: string;
}

export function CreateSession(config: SessionConfig): Promise<string>;
export function WriteToSession(id: string, data: string): Promise<void>;
export function ResizeSession(id: string, cols: number, rows: number): Promise<void>;
export function CloseSession(id: string): Promise<void>;
export function ListSessions(): Promise<SessionState[]>;
export function GetSessionLog(id: string): Promise<string>;
export function ResumeSession(id: string): Promise<void>;
export function RenameSessionBranch(id: string, newBranch: string): Promise<void>;
export function ArchiveSession(id: string): Promise<void>;
export function UnarchiveSession(id: string): Promise<void>;
export function DeleteArchivedSession(id: string): Promise<void>;
```

**Step 2: Update `Manager.js`**

Append to the end of the existing file:

```javascript
export function ArchiveSession(arg1) {
    return window['go']['session']['Manager']['ArchiveSession'](arg1);
}

export function UnarchiveSession(arg1) {
    return window['go']['session']['Manager']['UnarchiveSession'](arg1);
}

export function DeleteArchivedSession(arg1) {
    return window['go']['session']['Manager']['DeleteArchivedSession'](arg1);
}
```

**Step 3: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim/frontend && npm run build
```

Expected: clean build, no TypeScript errors.

**Step 4: Commit**

```bash
git add frontend/wailsjs/go/session/Manager.d.ts frontend/wailsjs/go/session/Manager.js
git commit -m "feat(bindings): add archive methods + repoPath/archived fields to session binding"
```

---

## Task 7: Update settings Wails bindings

**Files:**
- Modify: `frontend/wailsjs/go/settings/Manager.d.ts`

**Step 1: Add the new field**

In `Manager.d.ts`, add `archiveWorktreeCleanupDays` to the `Settings` interface:

```typescript
export interface Settings {
  defaultAgent: string;
  defaultWorktree: boolean;
  theme: string;
  shellPath: string;
  reposBaseDir: string;
  archiveWorktreeCleanupDays: number;
}
```

(Also add `reposBaseDir` which is in the Go struct but was missing from the TS binding.)

**Step 2: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim/frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/wailsjs/go/settings/Manager.d.ts
git commit -m "feat(bindings): add archiveWorktreeCleanupDays + reposBaseDir to Settings type"
```

---

## Task 8: Update Zustand store

**Files:**
- Modify: `frontend/src/stores/sessions.ts`

**Step 1: Add fields to `SessionState` interface**

```typescript
export interface SessionState {
  id: string
  workspaceId: string
  name: string
  agent: AgentType
  directory: string
  worktreePath: string
  branch: string
  status: SessionStatus
  archived: boolean       // true when in archive
  archivedAt?: string     // ISO timestamp set when archived
}
```

**Step 2: Add store actions to `AimStore` interface**

After `updateBranch`:

```typescript
archiveSession: (id: string) => void
unarchiveSession: (id: string) => void
deleteArchivedSession: (id: string) => void
```

**Step 3: Implement the actions**

Add to the `create` call, after the `updateBranch` implementation:

```typescript
archiveSession: (id) =>
  set((state) => ({
    workspaces: state.workspaces.map((w) => ({
      ...w,
      sessions: w.sessions.map((s) =>
        s.id === id ? { ...s, archived: true, archivedAt: new Date().toISOString() } : s
      ),
    })),
    activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
  })),

unarchiveSession: (id) =>
  set((state) => ({
    workspaces: state.workspaces.map((w) => ({
      ...w,
      sessions: w.sessions.map((s) =>
        s.id === id ? { ...s, archived: false, archivedAt: undefined } : s
      ),
    })),
  })),

deleteArchivedSession: (id) =>
  set((state) => ({
    workspaces: state.workspaces.map((w) => ({
      ...w,
      sessions: w.sessions.filter((s) => s.id !== id),
    })),
  })),
```

**Step 4: Update `addSession` default** — new sessions must have `archived: false`:

In the `addSession` action, the session is passed in wholesale. The callers in `App.tsx` already spread the fields. Just update the `addSession` call sites (in App.tsx Task 9) to include `archived: false`.

**Step 5: Update `loadPersistedSessions` mapping in App.tsx** — set `archived: ss.archived ?? false` (in Task 9).

**Step 6: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim/frontend && npm run build
```

**Step 7: Commit**

```bash
git add frontend/src/stores/sessions.ts
git commit -m "feat(store): add archived/archivedAt to SessionState, add archive actions"
```

---

## Task 9: `SessionHeader` — replace close with archive; update `App.tsx`

**Files:**
- Modify: `frontend/src/components/SessionHeader.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Update `SessionHeader.tsx`**

Replace the `handleClose` function and close button:

```typescript
// Replace handleClose:
const handleArchive = async () => {
  try {
    const { ArchiveSession } = await import('../../wailsjs/go/session/Manager')
    await ArchiveSession(session.id)
    archiveSession(session.id)
  } catch (err) {
    console.error('Archive failed:', err)
  }
}
```

Update the store destructure to include `archiveSession`:

```typescript
const { updateStatus, archiveSession } = useAimStore()
```

Replace the close `<button>` (the `×` SVG button at the bottom of the JSX) with:

```tsx
{/* Archive button */}
<button
  onClick={handleArchive}
  className="text-slate-600 hover:text-slate-400 transition-colors ml-1"
  title="Archive session"
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
</button>
```

**Step 2: Update `App.tsx` — add `repoPath` to `CreateSession` + `addSession`**

In `handleNewSession`, update the `CreateSession` call to include `repoPath`:

```typescript
const id = await CreateSession({
  name: tempBranch,
  agent: ws.agent,
  directory,
  useWorktree: isGit,
  worktreePath,
  branch,
  workspaceId,
  repoPath: isGit ? ws.path : '',
})

addSession({
  id,
  workspaceId,
  name: tempBranch,
  agent: ws.agent,
  directory,
  worktreePath,
  branch,
  status: 'idle',
  archived: false,
})
```

**Step 3: Update the `loadPersistedSessions` mapping** in `App.tsx` to include `archived`:

```typescript
sessions: (ws.sessions ?? []).map((s: any): SessionState => ({
  id: s.id,
  workspaceId: ws.id,
  name: s.name,
  agent: s.agent as AgentType,
  directory: s.directory,
  worktreePath: s.worktreePath ?? '',
  branch: s.branch ?? '',
  status: 'stopped',
  archived: s.archived ?? false,
  archivedAt: s.archivedAt,
})),
```

**Step 4: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim/frontend && npm run build
```

**Step 5: Commit**

```bash
git add frontend/src/components/SessionHeader.tsx frontend/src/App.tsx
git commit -m "feat(ui): archive button in SessionHeader, wire repoPath in App.tsx"
```

---

## Task 10: Sidebar — filter archived sessions + archive icon

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

**Step 1: Add `onArchivePanel` prop**

Add to `SidebarProps`:

```typescript
interface SidebarProps {
  onAddRepository: () => void
  onSettings: () => void
  onNewSession: (workspaceId: string) => void
  onArchivePanel: () => void
}
```

**Step 2: Filter archived sessions from `WorkspaceRow`**

In `WorkspaceRow`, update the sessions list render:

```tsx
{workspace.sessions.filter((s) => !s.archived).map((s) => (
  <SessionRow
    key={s.id}
    ...
  />
))}
```

Also update the `anyThinking` check to exclude archived:

```typescript
const anyThinking = workspace.sessions
  .filter((s) => !s.archived)
  .some((s) => s.status === 'thinking' || s.status === 'waiting')
```

**Step 3: Add archived count badge + archive icon to the bottom bar**

In the main `Sidebar` export, compute the archived count and pass `onArchivePanel`:

```typescript
export default function Sidebar({ onAddRepository, onSettings, onNewSession, onArchivePanel }: SidebarProps) {
  const { workspaces, activeSessionId, activeWorkspaceId, setActiveSession, toggleWorkspace } = useAimStore()
  const archivedCount = workspaces.flatMap((w) => w.sessions).filter((s) => s.archived).length
  ...
```

In the bottom actions section, add the archive button between "Add repository" and "Settings":

```tsx
<button
  onClick={onArchivePanel}
  className="w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg text-sm transition-colors"
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
  <span className="flex-1">Archive</span>
  {archivedCount > 0 && (
    <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
      {archivedCount}
    </span>
  )}
</button>
```

**Step 4: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim/frontend && npm run build
```

**Step 5: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat(sidebar): filter archived sessions, add archive icon with count badge"
```

---

## Task 11: Create `ArchivePanel` component

**Files:**
- Create: `frontend/src/components/ArchivePanel.tsx`

**Step 1: Write the component**

```tsx
import { useState } from 'react'
import { useAimStore, SessionState, AgentType } from '../stores/sessions'

interface ArchivePanelProps {
  onClose: () => void
}

const agentBadge: Record<AgentType, string> = {
  claude: 'bg-indigo-800 text-indigo-200',
  codex:  'bg-green-800 text-green-200',
  shell:  'bg-slate-700 text-slate-300',
}

function daysAgo(iso?: string): string | null {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  return days === 0 ? 'today' : `${days}d ago`
}

function ArchivedRow({ session, workspaceName }: { session: SessionState; workspaceName: string }) {
  const { unarchiveSession, deleteArchivedSession } = useAimStore()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleRestore = async () => {
    try {
      const { UnarchiveSession } = await import('../../wailsjs/go/session/Manager')
      await UnarchiveSession(session.id)
      unarchiveSession(session.id)
    } catch (err) {
      console.error('Restore failed:', err)
    }
  }

  const handleOpenFinder = async () => {
    const dir = session.worktreePath || session.directory
    if (!dir) return
    try {
      const { BrowserOpenURL } = await import('../../wailsjs/runtime/runtime')
      await BrowserOpenURL(`file://${dir}`)
    } catch {}
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    try {
      const { DeleteArchivedSession } = await import('../../wailsjs/go/session/Manager')
      await DeleteArchivedSession(session.id)
      deleteArchivedSession(session.id)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const workDir = session.worktreePath || session.directory

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/50 group">
      {/* Status dot (always grey for archived) */}
      <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />

      {/* Agent badge */}
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase shrink-0 ${agentBadge[session.agent]}`}>
        {session.agent}
      </span>

      {/* Branch / name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono text-slate-300 truncate">
          {session.branch || session.name}
        </p>
        <p className="text-xs text-slate-600 truncate" title={workDir}>
          {workspaceName} · {workDir}
        </p>
      </div>

      {/* Archived time */}
      {session.archivedAt && (
        <span className="text-xs text-slate-600 shrink-0">{daysAgo(session.archivedAt)}</span>
      )}

      {/* Actions (visible on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Restore */}
        <button
          onClick={handleRestore}
          title="Restore to sidebar"
          className="text-xs px-2 py-1 bg-emerald-800/60 hover:bg-emerald-700 text-emerald-300 rounded transition-colors"
        >
          Restore
        </button>

        {/* Open in Finder */}
        {workDir && (
          <button
            onClick={handleOpenFinder}
            title="Open in Finder"
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        )}

        {/* Delete */}
        <button
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
          title={confirmDelete ? 'Click again to confirm' : 'Delete permanently'}
          className={`p-1 transition-colors rounded ${
            confirmDelete
              ? 'text-red-400 bg-red-900/30'
              : 'text-slate-600 hover:text-red-400'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function ArchivePanel({ onClose }: ArchivePanelProps) {
  const { workspaces } = useAimStore()

  // Collect all archived sessions, grouped by workspace
  const groups = workspaces
    .map((w) => ({
      workspace: w,
      archived: w.sessions.filter((s) => s.archived),
    }))
    .filter((g) => g.archived.length > 0)

  const totalArchived = groups.reduce((n, g) => n + g.archived.length, 0)

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="w-[480px] h-full bg-[#131620] border-l border-slate-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">Archived Sessions</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalArchived} session{totalArchived !== 1 ? 's' : ''} · worktrees preserved
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {groups.length === 0 ? (
            <p className="text-sm text-slate-600 text-center mt-12">No archived sessions.</p>
          ) : (
            groups.map(({ workspace, archived }) => (
              <div key={workspace.id} className="mb-4">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide px-3 mb-1">
                  {workspace.name}
                </p>
                <div className="space-y-0.5">
                  {archived.map((s) => (
                    <ArchivedRow key={s.id} session={s} workspaceName={workspace.name} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim/frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/components/ArchivePanel.tsx
git commit -m "feat(ui): add ArchivePanel — restore/open-in-finder/delete archived sessions"
```

---

## Task 12: Settings — add cleanup days field

**Files:**
- Modify: `frontend/src/components/Settings.tsx`

**Step 1: Update `SettingsData` type**

```typescript
interface SettingsData {
  defaultAgent: string
  defaultWorktree: boolean
  theme: string
  shellPath: string
  reposBaseDir: string
  archiveWorktreeCleanupDays: number
}
```

**Step 2: Update default state**

```typescript
const [settings, setSettings] = useState<SettingsData>({
  defaultAgent: 'claude',
  defaultWorktree: true,
  theme: 'dark',
  shellPath: '/bin/zsh',
  reposBaseDir: '',
  archiveWorktreeCleanupDays: 7,
})
```

**Step 3: Add the cleanup days input** — add after the Shell Path section and before Theme:

```tsx
{/* Archive cleanup */}
<div className="mb-4">
  <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
    Clean up worktrees after (days)
  </label>
  <div className="flex items-center gap-3">
    <input
      type="number"
      min={0}
      value={settings.archiveWorktreeCleanupDays}
      onChange={(e) => setSettings((s) => ({ ...s, archiveWorktreeCleanupDays: parseInt(e.target.value) || 0 }))}
      className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
    />
    <span className="text-xs text-slate-500">0 = never</span>
  </div>
</div>
```

**Step 4: Verify**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim/frontend && npm run build
```

**Step 5: Commit**

```bash
git add frontend/src/components/Settings.tsx
git commit -m "feat(settings): add archive worktree cleanup days field"
```

---

## Task 13: Wire `ArchivePanel` in `App.tsx` + final build verification

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Add `showArchive` state and import**

Add near the top of `App`:

```typescript
const [showArchive, setShowArchive] = useState(false)
```

Add `ArchivePanel` to the imports at the top of the file:

```typescript
import ArchivePanel from './components/ArchivePanel'
```

**Step 2: Pass `onArchivePanel` to Sidebar**

```tsx
<Sidebar
  onAddRepository={() => setShowAddRepo(true)}
  onSettings={() => setShowSettings(true)}
  onNewSession={handleNewSession}
  onArchivePanel={() => setShowArchive(true)}
/>
```

**Step 3: Render ArchivePanel conditionally** — add after the `SettingsDialog` line:

```tsx
{showArchive && <ArchivePanel onClose={() => setShowArchive(false)} />}
```

**Step 4: Final build check**

```bash
cd /Users/bensmith/dev/src/github.com/Benbentwo/aim && go build ./...
cd frontend && npm run build
```

Both must be clean. If there are TypeScript errors, resolve them before committing.

**Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(app): wire ArchivePanel — showArchive state + sidebar prop"
```

---

## Summary of all changed files

| File | Change |
|---|---|
| `backend/session/manager.go` | `Archived`/`ArchivedAt` on `Session`; `RepoPath` on `SessionConfig`/`SessionState`; `ArchiveSession`, `UnarchiveSession`, `DeleteArchivedSession`, `cleanupStaleWorktrees` |
| `backend/settings/manager.go` | `ArchiveWorktreeCleanupDays int` in `Settings` + defaults |
| `frontend/wailsjs/go/session/Manager.d.ts` | New types + exports |
| `frontend/wailsjs/go/session/Manager.js` | New stubs |
| `frontend/wailsjs/go/settings/Manager.d.ts` | Updated `Settings` type |
| `frontend/src/stores/sessions.ts` | `archived`/`archivedAt` on `SessionState`; 3 new actions |
| `frontend/src/components/SessionHeader.tsx` | `×` → archive button |
| `frontend/src/components/Sidebar.tsx` | Filter archived; archive icon + badge; `onArchivePanel` prop |
| `frontend/src/components/ArchivePanel.tsx` | New component |
| `frontend/src/components/Settings.tsx` | Cleanup days field |
| `frontend/src/App.tsx` | `showArchive` state; `repoPath` in CreateSession; load archived flag |
