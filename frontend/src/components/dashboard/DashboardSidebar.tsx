import { useSessionStore, SessionStatus } from '../../stores/sessions'
import { useNavigationStore } from '../../stores/navigation'

const statusColors: Record<SessionStatus, string> = {
  idle: 'bg-emerald-400',
  thinking: 'bg-yellow-400 animate-pulse',
  waiting: 'bg-orange-400 animate-pulse',
  stopped: 'bg-slate-500',
  errored: 'bg-red-500',
}

export default function DashboardSidebar() {
  const { sessions, setActive } = useSessionStore()
  const { setView } = useNavigationStore()

  const handleClick = (sessionId: string) => {
    setActive(sessionId)
    setView('workspaces')
  }

  return (
    <>
      <div className="px-3 mb-3">
        <p className="text-[10px] uppercase tracking-wide text-slate-600 mb-2">Sessions</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => handleClick(session.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColors[session.status] ?? 'bg-slate-500'}`} />
            <span className="flex-1 text-xs font-medium truncate">{session.name}</span>
          </button>
        ))}
        {sessions.length === 0 && (
          <p className="text-xs text-slate-600 text-center mt-8 px-2">
            No sessions
          </p>
        )}
      </div>
    </>
  )
}
