import type { SessionMetrics } from '../../stores/dashboard'

interface StuckAgentsPanelProps {
  stuckAgents: SessionMetrics[]
  onSwitchToSession: (sessionId: string) => void
}

export default function StuckAgentsPanel({ stuckAgents, onSwitchToSession }: StuckAgentsPanelProps) {
  if (stuckAgents.length === 0) return null

  return (
    <div className="bg-orange-950/20 border border-orange-900/50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-orange-400 mb-3">
        Stuck Agents ({stuckAgents.length})
      </h3>
      <div className="space-y-2">
        {stuckAgents.map((agent) => (
          <div key={agent.sessionId} className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shrink-0" />
            <span className="text-sm text-slate-300 flex-1 truncate">{agent.sessionName}</span>
            <span className="text-[10px] text-slate-500">
              Waiting {Math.floor(agent.waitingTime / 60)}m
            </span>
            <button
              onClick={() => onSwitchToSession(agent.sessionId)}
              className="px-2.5 py-1 text-[10px] font-medium bg-orange-800 hover:bg-orange-700 text-orange-200 rounded transition-colors"
            >
              Switch
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
