import { useEffect } from 'react'
import { useDashboardStore, subscribeToDashboardEvents, unsubscribeFromDashboardEvents } from '../../stores/dashboard'
import { useSessionStore } from '../../stores/sessions'
import { useNavigationStore } from '../../stores/navigation'
import ActivityChart from './ActivityChart'
import AgentStatusGrid from './AgentStatusGrid'
import StuckAgentsPanel from './StuckAgentsPanel'

export default function AgentDashboardView() {
  const { sessions, history, stuckAgents, fetchDashboard } = useDashboardStore()
  const { setActive } = useSessionStore()
  const { setView } = useNavigationStore()

  useEffect(() => {
    fetchDashboard()
    subscribeToDashboardEvents()
    return () => unsubscribeFromDashboardEvents()
  }, [])

  const handleSwitchToSession = (sessionId: string) => {
    setActive(sessionId)
    setView('workspaces')
  }

  const activeSessions = sessions.filter((s) => s.status !== 'stopped' && s.status !== 'errored')
  const thinkingCount = sessions.filter((s) => s.status === 'thinking').length
  const waitingCount = sessions.filter((s) => s.status === 'waiting').length
  const idleCount = sessions.filter((s) => s.status === 'idle').length

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold text-slate-200 mb-1">Agent Dashboard</h1>
          <p className="text-sm text-slate-500">Monitor your AI agent sessions</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Active" value={activeSessions.length} color="text-slate-200" />
          <StatCard label="Thinking" value={thinkingCount} color="text-yellow-400" />
          <StatCard label="Waiting" value={waitingCount} color="text-orange-400" />
          <StatCard label="Idle" value={idleCount} color="text-emerald-400" />
        </div>

        {/* Stuck agents */}
        <StuckAgentsPanel stuckAgents={stuckAgents} onSwitchToSession={handleSwitchToSession} />

        {/* Activity chart */}
        <div className="bg-[#1a1e2e] border border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-medium text-slate-400 mb-3">Activity Over Time</h2>
          <ActivityChart history={history} />
          <div className="flex gap-4 mt-2 justify-center">
            <Legend color="bg-yellow-400" label="Thinking" />
            <Legend color="bg-orange-400" label="Waiting" />
            <Legend color="bg-emerald-400" label="Idle" />
          </div>
        </div>

        {/* All sessions */}
        <div>
          <h2 className="text-sm font-medium text-slate-400 mb-3">All Sessions</h2>
          <AgentStatusGrid sessions={sessions} onSwitchToSession={handleSwitchToSession} />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#1a1e2e] border border-slate-700 rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">{label}</p>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  )
}
