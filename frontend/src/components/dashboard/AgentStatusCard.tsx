import type { SessionMetrics } from '../../stores/dashboard'

const statusColors: Record<string, string> = {
  idle: 'bg-emerald-400',
  thinking: 'bg-yellow-400 animate-pulse',
  waiting: 'bg-orange-400 animate-pulse',
  stopped: 'bg-slate-500',
  errored: 'bg-red-500',
}

const agentBadgeColors: Record<string, string> = {
  claude: 'bg-indigo-800 text-indigo-200',
  codex: 'bg-green-800 text-green-200',
  shell: 'bg-slate-700 text-slate-300',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

interface AgentStatusCardProps {
  metrics: SessionMetrics
  onSwitch: () => void
}

export default function AgentStatusCard({ metrics, onSwitch }: AgentStatusCardProps) {
  const total = metrics.thinkingTime + metrics.waitingTime + metrics.idleTime
  const thinkingPct = total > 0 ? (metrics.thinkingTime / total) * 100 : 0
  const waitingPct = total > 0 ? (metrics.waitingTime / total) * 100 : 0
  const idlePct = total > 0 ? (metrics.idleTime / total) * 100 : 0

  return (
    <button
      onClick={onSwitch}
      className={`text-left p-3 rounded-lg border transition-colors hover:border-slate-600 ${
        metrics.isStuck
          ? 'bg-orange-950/30 border-orange-800'
          : 'bg-[#1a1e2e] border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColors[metrics.status] ?? 'bg-slate-500'}`} />
        <span className="text-sm font-medium text-slate-200 truncate flex-1">{metrics.sessionName}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${agentBadgeColors[metrics.agent] ?? 'bg-slate-700 text-slate-300'}`}>
          {metrics.agent}
        </span>
      </div>

      {/* Time breakdown bar */}
      {total > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800 mb-2">
          {thinkingPct > 0 && <div className="bg-yellow-400" style={{ width: `${thinkingPct}%` }} />}
          {waitingPct > 0 && <div className="bg-orange-400" style={{ width: `${waitingPct}%` }} />}
          {idlePct > 0 && <div className="bg-emerald-400" style={{ width: `${idlePct}%` }} />}
        </div>
      )}

      <div className="flex gap-3 text-[10px] text-slate-500">
        <span>Thinking: {formatDuration(metrics.thinkingTime)}</span>
        <span>Waiting: {formatDuration(metrics.waitingTime)}</span>
        <span>Idle: {formatDuration(metrics.idleTime)}</span>
      </div>

      {metrics.isStuck && (
        <div className="mt-2 text-[10px] text-orange-400 font-medium">
          Stuck — waiting for input
        </div>
      )}
    </button>
  )
}
