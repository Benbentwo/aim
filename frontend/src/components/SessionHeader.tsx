import { SessionState, SessionStatus, useAimStore } from '../stores/sessions'

interface SessionHeaderProps {
  session: SessionState
}

const statusLabels: Record<SessionStatus, string> = {
  idle:     'Idle',
  thinking: 'Thinking…',
  waiting:  'Waiting',
  stopped:  'Stopped',
  errored:  'Error',
}

const statusColors: Record<SessionStatus, string> = {
  idle:     'text-emerald-400',
  thinking: 'text-yellow-400',
  waiting:  'text-orange-400',
  stopped:  'text-slate-500',
  errored:  'text-red-400',
}

const agentColors: Record<string, string> = {
  claude: 'bg-indigo-900/50 text-indigo-300 border border-indigo-700',
  codex:  'bg-green-900/50 text-green-300 border border-green-700',
  shell:  'bg-slate-800 text-slate-300 border border-slate-700',
}

export default function SessionHeader({ session }: SessionHeaderProps) {
  const { updateStatus, removeSession } = useAimStore()
  const workDir = session.worktreePath || session.directory
  const isWorktree = Boolean(session.worktreePath)
  const isStopped = session.status === 'stopped' || session.status === 'errored'

  const handleResume = async () => {
    try {
      const { ResumeSession } = await import('../../wailsjs/go/session/Manager')
      await ResumeSession(session.id)
      updateStatus(session.id, 'idle')
    } catch (err) {
      console.error('Resume failed:', err)
    }
  }

  const handleClose = async () => {
    try {
      const { CloseSession } = await import('../../wailsjs/go/session/Manager')
      await CloseSession(session.id)
      removeSession(session.id)
    } catch (err) {
      console.error('Close failed:', err)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#131620] border-b border-slate-800 min-h-[44px] no-select">
      {/* Agent badge */}
      <span
        className={`text-xs px-2 py-0.5 rounded font-mono font-semibold uppercase ${agentColors[session.agent] ?? agentColors.shell}`}
      >
        {session.agent}
      </span>

      {/* Worktree / dir badge */}
      {isWorktree && (
        <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700 font-mono">
          worktree
        </span>
      )}
      {session.branch && (
        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
          {session.branch}
        </span>
      )}

      {/* Path */}
      <span className="flex-1 text-sm text-slate-500 font-mono truncate" title={workDir}>
        {workDir}
      </span>

      {/* Status */}
      <span className={`text-xs font-medium ${statusColors[session.status]}`}>
        {statusLabels[session.status]}
      </span>

      {/* Resume button (shown when stopped/errored) */}
      {isStopped && (
        <button
          onClick={handleResume}
          className="text-xs px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md transition-colors font-medium"
        >
          Resume
        </button>
      )}

      {/* Close button */}
      <button
        onClick={handleClose}
        className="text-slate-600 hover:text-slate-400 transition-colors ml-1"
        title="Close session"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
