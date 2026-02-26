import { useCallback } from 'react'
import { useAimStore, WorkspaceState, SessionState, SessionStatus, AgentType } from '../stores/sessions'

interface SidebarProps {
  onAddRepository: () => void
  onSettings: () => void
  onNewSession: (workspaceId: string) => void
}

const statusColors: Record<SessionStatus, string> = {
  idle:     'bg-emerald-400',
  thinking: 'bg-yellow-400 animate-pulse',
  waiting:  'bg-orange-400 animate-pulse',
  stopped:  'bg-slate-500',
  errored:  'bg-red-500',
}

const agentBadge: Record<AgentType, string> = {
  claude: 'bg-indigo-800 text-indigo-200',
  codex:  'bg-green-800 text-green-200',
  shell:  'bg-slate-700 text-slate-300',
}

function StatusDot({ status }: { status: SessionStatus }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColors[status] ?? 'bg-slate-500'}`} />
  )
}

function SessionRow({ session, isActive, onClick }: {
  session: SessionState
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-left rounded-md transition-colors text-xs ${
        isActive
          ? 'bg-slate-700 text-white'
          : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
      }`}
    >
      <StatusDot status={session.status} />
      <span className="flex-1 truncate font-mono">{session.branch || session.name}</span>
      <span className={`text-[10px] ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>
        {session.status === 'thinking' ? '…' : session.status === 'stopped' ? '■' : ''}
      </span>
    </button>
  )
}

function WorkspaceRow({ workspace, isActiveWs, activeSessionId, onSessionClick, onNewSession, onToggle }: {
  workspace: WorkspaceState
  isActiveWs: boolean
  activeSessionId: string | null
  onSessionClick: (sessionId: string, workspaceId: string) => void
  onNewSession: (workspaceId: string) => void
  onToggle: (id: string) => void
}) {
  const anyThinking = workspace.sessions.some((s) => s.status === 'thinking' || s.status === 'waiting')

  return (
    <div>
      {/* Workspace header row */}
      <button
        aria-expanded={workspace.expanded}
        onClick={() => onToggle(workspace.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          isActiveWs && !workspace.expanded
            ? 'bg-slate-700 text-white'
            : 'text-slate-300 hover:bg-slate-800'
        }`}
      >
        {/* Chevron */}
        <span className={`text-slate-500 transition-transform text-xs ${workspace.expanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
        <span className="flex-1 text-sm font-medium truncate">{workspace.name}</span>
        {anyThinking && (
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${agentBadge[workspace.agent]}`}>
          {workspace.agent}
        </span>
      </button>

      {/* Sessions (visible when expanded) */}
      {workspace.expanded && (
        <div className="mt-0.5 space-y-0.5">
          {workspace.sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onClick={() => onSessionClick(s.id, workspace.id)}
            />
          ))}
          {/* + New session */}
          <button
            onClick={() => onNewSession(workspace.id)}
            className="w-full flex items-center gap-2 pl-7 pr-3 py-1.5 text-xs text-slate-600 hover:text-indigo-400 hover:bg-slate-800 rounded-md transition-colors"
          >
            <span>+</span>
            <span>New session</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ onAddRepository, onSettings, onNewSession }: SidebarProps) {
  const { workspaces, activeSessionId, activeWorkspaceId, setActiveSession, toggleWorkspace } = useAimStore()

  const handleSessionClick = useCallback((sessionId: string, workspaceId: string) => {
    setActiveSession(sessionId, workspaceId)
  }, [setActiveSession])

  return (
    <div className="flex flex-col w-60 shrink-0 bg-[#131620] border-r border-slate-800 pt-10 no-select">
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {workspaces.map((ws) => (
          <WorkspaceRow
            key={ws.id}
            workspace={ws}
            isActiveWs={ws.id === activeWorkspaceId}
            activeSessionId={activeSessionId}
            onSessionClick={handleSessionClick}
            onNewSession={onNewSession}
            onToggle={toggleWorkspace}
          />
        ))}
        {workspaces.length === 0 && (
          <p className="text-xs text-slate-600 text-center mt-8 px-3">
            No repositories yet.
          </p>
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-3 py-3 border-t border-slate-800 space-y-1">
        <button
          onClick={onAddRepository}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span>Add repository</span>
        </button>
        <button
          onClick={onSettings}
          title="Settings"
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}
