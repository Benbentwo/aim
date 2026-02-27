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
  archived: boolean       // true when in archive
  archivedAt?: string     // ISO timestamp set when archived
}

export interface WorkspaceState {
  id: string
  name: string
  path: string
  agent: AgentType
  cloned: boolean
  expanded: boolean       // UI-only: whether sidebar row is expanded
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
  updateBranch: (id: string, branch: string) => void
  archiveSession: (id: string) => void
  unarchiveSession: (id: string) => void
  deleteArchivedSession: (id: string) => void
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
    set((state) => {
      const ws = state.workspaces.find((w) => w.id === id)
      const removedHasActive = ws?.sessions.some((s) => s.id === state.activeSessionId)
      return {
        workspaces: state.workspaces.filter((w) => w.id !== id),
        activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId,
        activeSessionId: removedHasActive ? null : state.activeSessionId,
      }
    }),

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

  updateBranch: (id, branch) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) =>
          s.id === id ? { ...s, branch, name: branch } : s
        ),
      })),
    })),

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

  setActiveSession: (sessionId, workspaceId) =>
    set({ activeSessionId: sessionId, activeWorkspaceId: workspaceId }),
}))

// Compat hook for components that use the flat session interface
export const useSessionStore = () => {
  const store = useAimStore()
  const sessions = store.workspaces.flatMap((w) => w.sessions)
  return {
    sessions,
    activeSessionId: store.activeSessionId,
    setActive: (id: string | null) => {
      const session = sessions.find((s) => s.id === id)
      store.setActiveSession(id, session?.workspaceId ?? null)
    },
    addSession: store.addSession,
    updateStatus: store.updateStatus,
  }
}
