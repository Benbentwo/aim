import { create } from 'zustand'

declare const window: Window & {
  runtime?: {
    EventsOn: (event: string, callback: (...args: unknown[]) => void) => void
    EventsOff: (event: string) => void
  }
}

export interface SessionMetrics {
  sessionId: string
  sessionName: string
  agent: string
  status: string
  thinkingTime: number
  waitingTime: number
  idleTime: number
  totalTime: number
  lastActivity: string
  isStuck: boolean
}

export interface MetricSnapshot {
  timestamp: string
  activeCount: number
  thinkingCount: number
  waitingCount: number
  idleCount: number
}

export interface DashboardData {
  sessions: SessionMetrics[]
  history: MetricSnapshot[]
  stuckAgents: SessionMetrics[]
}

interface DashboardStore {
  sessions: SessionMetrics[]
  history: MetricSnapshot[]
  stuckAgents: SessionMetrics[]
  isLoading: boolean

  setData: (data: DashboardData) => void
  fetchDashboard: () => Promise<void>
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  sessions: [],
  history: [],
  stuckAgents: [],
  isLoading: false,

  setData: (data) =>
    set({
      sessions: data.sessions ?? [],
      history: data.history ?? [],
      stuckAgents: data.stuckAgents ?? [],
    }),

  fetchDashboard: async () => {
    try {
      const { GetDashboardData } = await import('../../wailsjs/go/agent/Tracker')
      const data = await GetDashboardData()
      if (data) {
        set({
          sessions: (data as any).sessions ?? [],
          history: (data as any).history ?? [],
          stuckAgents: (data as any).stuckAgents ?? [],
        })
      }
    } catch {}
  },
}))

export function subscribeToDashboardEvents() {
  window.runtime?.EventsOn('agent:metrics:updated', (data: unknown) => {
    const d = data as DashboardData
    if (d) {
      useDashboardStore.getState().setData(d)
    }
  })
}

export function unsubscribeFromDashboardEvents() {
  window.runtime?.EventsOff('agent:metrics:updated')
}
