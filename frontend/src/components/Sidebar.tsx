import { useSessionStore, SessionState, SessionStatus } from '../stores/sessions'
import { useNavigationStore } from '../stores/navigation'
import ViewSwitcher from './ViewSwitcher'
import LinearSidebar from './linear/LinearSidebar'
import DashboardSidebar from './dashboard/DashboardSidebar'

interface SidebarProps {
  onNewSession: () => void
  onSettings: () => void
}

const statusColors: Record<SessionStatus, string> = {
  idle:     'bg-emerald-400',
  thinking: 'bg-yellow-400 animate-pulse',
  waiting:  'bg-orange-400 animate-pulse',
  stopped:  'bg-slate-500',
  errored:  'bg-red-500',
}

const agentBadgeColors: Record<string, string> = {
  claude: 'bg-indigo-800 text-indigo-200',
  codex:  'bg-green-800 text-green-200',
  shell:  'bg-slate-700 text-slate-300',
}

function StatusDot({ status }: { status: SessionStatus }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColors[status] ?? 'bg-slate-500'}`}
    />
  )
}

function AgentBadge({ agent }: { agent: string }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${agentBadgeColors[agent] ?? 'bg-slate-700 text-slate-300'}`}
    >
      {agent}
    </span>
  )
}

function SessionTab({
  session,
  isActive,
  onClick,
}: {
  session: SessionState
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left rounded-lg transition-colors group ${
        isActive
          ? 'bg-slate-700 text-white'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      <StatusDot status={session.status} />
      <span className="flex-1 text-sm font-medium truncate">{session.name}</span>
      <AgentBadge agent={session.agent} />
    </button>
  )
}

export { StatusDot, AgentBadge }

export default function Sidebar({ onNewSession, onSettings }: SidebarProps) {
  const { sessions, activeSessionId, setActive } = useSessionStore()
  const { activeView } = useNavigationStore()

  return (
    <div className="relative flex flex-col w-56 shrink-0 bg-[#131620] border-r border-slate-800 pt-10 no-select">
      <ViewSwitcher />

      {activeView === 'workspaces' && (
        <>
          {/* New session button */}
          <div className="px-3 mb-3">
            <button
              onClick={onNewSession}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <span className="text-base leading-none">+</span>
              <span>New</span>
            </button>
          </div>

          {/* Session tabs */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {sessions.map((session) => (
              <SessionTab
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onClick={() => setActive(session.id)}
              />
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-slate-600 text-center mt-8 px-2">
                No sessions yet. Create one to get started.
              </p>
            )}
          </div>
        </>
      )}

      {activeView === 'dashboard' && (
        <DashboardSidebar />
      )}

      {activeView === 'linear' && (
        <LinearSidebar />
      )}

      {/* Settings icon at bottom */}
      <div className="px-3 py-3 border-t border-slate-800">
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg text-sm transition-colors"
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}
