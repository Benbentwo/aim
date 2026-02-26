import { create } from 'zustand'

export type AgentType = 'claude' | 'codex' | 'shell'
export type SessionStatus = 'idle' | 'thinking' | 'waiting' | 'stopped' | 'errored'

export interface SessionState {
  id: string
  name: string
  agent: AgentType
  directory: string
  worktreePath: string
  branch: string
  status: SessionStatus
}

interface SessionStore {
  sessions: SessionState[]
  activeSessionId: string | null

  // Actions
  setSessions: (sessions: SessionState[]) => void
  addSession: (session: SessionState) => void
  removeSession: (id: string) => void
  updateStatus: (id: string, status: SessionStatus) => void
  setActive: (id: string | null) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessions: [],
  activeSessionId: null,

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    })),

  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId:
        state.activeSessionId === id
          ? (state.sessions.find((s) => s.id !== id)?.id ?? null)
          : state.activeSessionId,
    })),

  updateStatus: (id, status) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, status } : s
      ),
    })),

  setActive: (id) => set({ activeSessionId: id }),
}))
