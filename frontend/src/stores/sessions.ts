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

  setActiveSession: (sessionId, workspaceId) =>
    set({ activeSessionId: sessionId, activeWorkspaceId: workspaceId }),
}))
