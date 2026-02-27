# Session Archive Design

**Date:** 2026-02-26
**Status:** Approved

## Problem

The current "close session" (`×` button) permanently deletes the session — PTY killed, metadata removed, tab gone. There is no way to park a session and come back to it later without losing context. Conductor-style workflows keep the worktree branch alive until the user explicitly cleans up.

## Goals

- Archive a session (keep worktree + scrollback, hide from active sidebar)
- View archived sessions in a dedicated panel
- Restore (unarchive) a session to resume later
- Delete archived sessions when done
- Auto-cleanup worktrees after a configurable number of days

## Non-Goals (v1)

- Delete worktree on archive (worktrees are always kept on archive)
- Right-click context menus (archive is triggered only from the `×` button)
- Copy branch name from archive panel

---

## Data Model

### Go: `SessionState` additions

```go
Archived   bool       `json:"archived,omitempty"`
ArchivedAt *time.Time `json:"archivedAt,omitempty"`
```

### Frontend: `SessionState` additions (stores/sessions.ts)

```ts
archived: boolean
archivedAt?: string  // ISO timestamp
```

### Settings addition

```json
"archiveWorktreeCleanupDays": 7
```

`0` = never clean up. Default: `7`.

---

## Backend API

### New methods on `session.Manager`

```go
// ArchiveSession kills the PTY (if running), marks archived=true,
// records archivedAt=now, and persists. Worktree is left on disk.
ArchiveSession(id string) error

// UnarchiveSession clears archived=false and archivedAt=nil, persists.
// Does NOT re-spawn the PTY.
UnarchiveSession(id string) error

// DeleteArchivedSession removes session metadata and scrollback log.
// Worktree is NOT removed (user manages branch via git).
// Returns error if session is not archived.
DeleteArchivedSession(id string) error
```

`CloseSession` is kept for backward compatibility (used internally) but no longer exposed in normal UI flows.

### Worktree auto-cleanup

On `SetContext` (app startup), the manager calls `cleanupStaleWorktrees()`:

1. Load `settings.archiveWorktreeCleanupDays` (default 7, skip if 0)
2. For each archived session where `archivedAt != nil` and `now - archivedAt > cleanupDays`:
   - `git worktree remove --force <worktreePath>`
   - Clear `session.Config.WorktreePath` in memory + persist

---

## Frontend

### Zustand store additions

```ts
archiveSession(id: string): void
  // sets archived=true, archivedAt=now on matching session

unarchiveSession(id: string): void
  // sets archived=false, archivedAt=undefined

deleteArchivedSession(id: string): void
  // removes session from store entirely (like removeSession)
```

### `SessionHeader.tsx` changes

- `×` button calls `ArchiveSession` (backend) then `archiveSession` (store)
- Tooltip: "Archive session"
- Remove the `CloseSession` / `removeSession` call

### `Sidebar.tsx` changes

- Filter `workspace.sessions` to `!s.archived` (archived sessions hidden from tabs)
- Add archive-box icon button at the bottom bar (between "Add repository" and "Settings")
- Show a numeric badge on the icon when archived count > 0

### `ArchivePanel.tsx` (new component)

Full-width slide-in panel (or overlay), opened by the archive icon in the sidebar.

**Layout:**
- Header: "Archived Sessions" + close button
- Sessions grouped by workspace name
- Each row: grey status dot · agent badge · branch name · truncated worktree path
  - If worktree cleanup is enabled and `archivedAt` is set, show "expires in N days"
- Per-row actions:
  - **Restore** button → `UnarchiveSession` + `unarchiveSession` → session reappears in sidebar as stopped
  - **Open in Finder** icon → Wails `OpenDirectoryInFileBrowser(worktreePath)`
  - **Delete** trash icon → inline confirm (icon turns red on hover, second click confirms) → `DeleteArchivedSession` + `deleteArchivedSession`

### `Settings.tsx` changes

Add field: "Clean up worktrees after N days (0 = never)" with a number input.

---

## Behavior Summary

| Event | PTY | Worktree | scrollback.log | sessions.json |
|---|---|---|---|---|
| Archive | killed | kept | kept | `archived: true`, `archivedAt: now` |
| Auto-cleanup (after N days) | — | removed | kept | `worktreePath: ""` updated |
| Unarchive | — | unchanged | unchanged | `archived: false`, `archivedAt: nil` |
| Delete from panel | — | kept | deleted | entry removed |

---

## Wails Bindings to Add

- `session/Manager.d.ts`: `ArchiveSession`, `UnarchiveSession`, `DeleteArchivedSession`
- `session/Manager.js`: corresponding stubs
- `settings/Manager.d.ts`: update `Settings` type to include `ArchiveWorktreeCleanupDays`

---

## File Checklist

| File | Change |
|---|---|
| `backend/session/manager.go` | Add `ArchiveSession`, `UnarchiveSession`, `DeleteArchivedSession`, `cleanupStaleWorktrees` |
| `backend/session/persist.go` | No change needed (SessionState serialization handles new fields) |
| `backend/settings/manager.go` | Add `ArchiveWorktreeCleanupDays int` to `Settings` |
| `frontend/wailsjs/go/session/Manager.d.ts` | Add 3 new method exports + update `SessionState` type |
| `frontend/wailsjs/go/session/Manager.js` | Add 3 new stubs |
| `frontend/wailsjs/go/settings/Manager.d.ts` | Update `Settings` type |
| `frontend/src/stores/sessions.ts` | Add `archived`, `archivedAt` to `SessionState`; add 3 store actions |
| `frontend/src/components/SessionHeader.tsx` | `×` → archive, call `ArchiveSession` + `archiveSession` |
| `frontend/src/components/Sidebar.tsx` | Filter archived sessions; add archive icon + badge |
| `frontend/src/components/ArchivePanel.tsx` | New component |
| `frontend/src/components/Settings.tsx` | Add cleanup days field |
| `frontend/src/App.tsx` | Wire `showArchive` state + pass to Sidebar + render ArchivePanel |
