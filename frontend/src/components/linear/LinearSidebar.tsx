import { useLinearStore } from '../../stores/linear'
import { useSessionStore } from '../../stores/sessions'
import { useNavigationStore } from '../../stores/navigation'

export default function LinearSidebar() {
  const { bindings } = useLinearStore()
  const { sessions, activeSessionId, setActive } = useSessionStore()
  const { setView } = useNavigationStore()

  const activeBindings = Object.values(bindings).filter((b) => b.status === 'active')

  const handleSwitchToSession = (sessionId: string) => {
    setActive(sessionId)
    setView('workspaces')
  }

  return (
    <>
      <div className="px-3 mb-3">
        <p className="text-[10px] uppercase tracking-wide text-slate-600 mb-2">Active Workspaces</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {activeBindings.map((binding) => {
          const boundSessions = sessions.filter((s) => binding.sessionIds.includes(s.id))
          return (
            <div key={binding.issueId} className="mb-2">
              <p className="text-[10px] font-mono text-slate-500 px-3 mb-0.5">{binding.issueIdentifier}</p>
              {boundSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSwitchToSession(session.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors ${
                    session.id === activeSessionId
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                      session.status === 'idle'
                        ? 'bg-emerald-400'
                        : session.status === 'thinking'
                        ? 'bg-yellow-400 animate-pulse'
                        : session.status === 'waiting'
                        ? 'bg-orange-400 animate-pulse'
                        : session.status === 'errored'
                        ? 'bg-red-500'
                        : 'bg-slate-500'
                    }`}
                  />
                  <span className="flex-1 text-xs font-medium truncate">{session.name}</span>
                </button>
              ))}
            </div>
          )
        })}

        {activeBindings.length === 0 && (
          <p className="text-xs text-slate-600 text-center mt-8 px-2">
            No active Linear workspaces. Click a task to start one.
          </p>
        )}
      </div>
    </>
  )
}
