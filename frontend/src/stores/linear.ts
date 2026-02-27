import { create } from 'zustand'
import type {
  LinearTeam,
  LinearIssue,
  LinearUser,
  LinearState,
  LinearCycle,
  CycleIssuesResponse,
  TaskWorkspaceBinding,
} from '../types/linear'

declare const window: Window & {
  runtime?: {
    EventsOn: (event: string, callback: (...args: unknown[]) => void) => void
    EventsOff: (event: string) => void
  }
}

export type AuthMethod = 'oauth' | 'apikey' | null

interface LinearStore {
  // Connection
  isConnected: boolean
  authMethod: AuthMethod
  me: LinearUser | null

  // Data
  teams: LinearTeam[]
  selectedTeamId: string | null
  cycle: LinearCycle | null
  issues: LinearIssue[]
  states: LinearState[]

  // Filters
  filterPriority: number | null
  filterAssignee: string | null // 'me' or user ID or null
  filterStateType: string | null
  filterTeamKey: string | null // team key (e.g. 'ATMOS') or null for all
  sortBy: 'priority' | 'updated' | 'created'

  // Workspace bindings
  bindings: Record<string, TaskWorkspaceBinding>

  // Actions
  setConnected: (connected: boolean, me?: LinearUser | null, method?: AuthMethod) => void
  disconnect: () => Promise<void>
  setTeams: (teams: LinearTeam[]) => void
  selectTeam: (teamId: string) => void
  setCycleData: (data: CycleIssuesResponse) => void
  setFilter: (key: 'filterPriority' | 'filterAssignee' | 'filterStateType' | 'filterTeamKey', value: any) => void
  setSortBy: (sort: 'priority' | 'updated' | 'created') => void
  bindTaskToWorkspace: (issueId: string, binding: TaskWorkspaceBinding) => void
  updateBinding: (issueId: string, updates: Partial<TaskWorkspaceBinding>) => void
}

export const useLinearStore = create<LinearStore>((set) => ({
  isConnected: false,
  authMethod: null,
  me: null,
  teams: [],
  selectedTeamId: null,
  cycle: null,
  issues: [],
  states: [],
  filterPriority: null,
  filterAssignee: null,
  filterStateType: null,
  filterTeamKey: null,
  sortBy: 'priority',
  bindings: {},

  setConnected: (connected, me, method) =>
    set({ isConnected: connected, me: me ?? null, authMethod: method ?? null }),
  disconnect: async () => {
    try {
      const { Disconnect } = await import('../../wailsjs/go/linear/Manager')
      await Disconnect()
      const { GetSettings, SaveSettings } = await import('../../wailsjs/go/settings/Manager')
      const s = await GetSettings()
      await SaveSettings({ ...s, linearApiKey: '', linearOAuthToken: '' } as any)
    } catch {}
    set({
      isConnected: false,
      authMethod: null,
      me: null,
      teams: [],
      selectedTeamId: null,
      cycle: null,
      issues: [],
      states: [],
    })
  },
  setTeams: (teams) => set({ teams }),
  selectTeam: (teamId) => set({ selectedTeamId: teamId }),
  setCycleData: (data) =>
    set({
      cycle: data.cycle,
      issues: data.issues,
      states: data.states,
    }),
  setFilter: (key, value) => set({ [key]: value }),
  setSortBy: (sort) => set({ sortBy: sort }),
  bindTaskToWorkspace: (issueId, binding) =>
    set((state) => ({
      bindings: { ...state.bindings, [issueId]: binding },
    })),
  updateBinding: (issueId, updates) =>
    set((state) => ({
      bindings: {
        ...state.bindings,
        [issueId]: { ...state.bindings[issueId], ...updates },
      },
    })),
}))

// Subscribe to Linear polling events
export function subscribeToLinearEvents() {
  window.runtime?.EventsOn('linear:issues:updated', (data: unknown) => {
    const resp = data as CycleIssuesResponse
    if (resp) {
      useLinearStore.getState().setCycleData(resp)
    }
  })
}

export function unsubscribeFromLinearEvents() {
  window.runtime?.EventsOff('linear:issues:updated')
}
