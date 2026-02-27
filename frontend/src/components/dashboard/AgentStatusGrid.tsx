import type { SessionMetrics } from '../../stores/dashboard'
import AgentStatusCard from './AgentStatusCard'

interface AgentStatusGridProps {
  sessions: SessionMetrics[]
  onSwitchToSession: (sessionId: string) => void
}

export default function AgentStatusGrid({ sessions, onSwitchToSession }: AgentStatusGridProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-xs text-slate-600 text-center py-8">
        No active sessions
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sessions.map((m) => (
        <AgentStatusCard
          key={m.sessionId}
          metrics={m}
          onSwitch={() => onSwitchToSession(m.sessionId)}
        />
      ))}
    </div>
  )
}
