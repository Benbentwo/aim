import { useState } from 'react'
import { useAimStore, SessionState, AgentType } from '../stores/sessions'

interface ArchivePanelProps {
  onClose: () => void
}

const agentBadge: Record<AgentType, string> = {
  claude: 'bg-indigo-800 text-indigo-200',
  codex:  'bg-green-800 text-green-200',
  shell:  'bg-slate-700 text-slate-300',
}

function daysAgo(iso?: string): string | null {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  return days === 0 ? 'today' : `${days}d ago`
}

function ArchivedRow({ session, workspaceName }: { session: SessionState; workspaceName: string }) {
  const { unarchiveSession, deleteArchivedSession } = useAimStore()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleRestore = async () => {
    try {
      const { UnarchiveSession } = await import('../../wailsjs/go/session/Manager')
      await UnarchiveSession(session.id)
      unarchiveSession(session.id)
    } catch (err) {
      console.error('Restore failed:', err)
    }
  }

  const handleOpenFinder = async () => {
    const dir = session.worktreePath || session.directory
    if (!dir) return
    try {
      const { BrowserOpenURL } = await import('../../wailsjs/runtime/runtime')
      await BrowserOpenURL(`file://${dir}`)
    } catch {}
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    try {
      const { DeleteArchivedSession } = await import('../../wailsjs/go/session/Manager')
      await DeleteArchivedSession(session.id)
      deleteArchivedSession(session.id)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const workDir = session.worktreePath || session.directory

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/50 group">
      {/* Status dot (always grey for archived) */}
      <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />

      {/* Agent badge */}
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase shrink-0 ${agentBadge[session.agent]}`}>
        {session.agent}
      </span>

      {/* Branch / name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono text-slate-300 truncate">
          {session.branch || session.name}
        </p>
        <p className="text-xs text-slate-600 truncate" title={workDir}>
          {workspaceName} · {workDir}
        </p>
      </div>

      {/* Archived time */}
      {session.archivedAt && (
        <span className="text-xs text-slate-600 shrink-0">{daysAgo(session.archivedAt)}</span>
      )}

      {/* Actions (visible on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Restore */}
        <button
          onClick={handleRestore}
          title="Restore to sidebar"
          className="text-xs px-2 py-1 bg-emerald-800/60 hover:bg-emerald-700 text-emerald-300 rounded transition-colors"
        >
          Restore
        </button>

        {/* Open in Finder */}
        {workDir && (
          <button
            onClick={handleOpenFinder}
            title="Open in Finder"
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        )}

        {/* Delete */}
        <button
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
          title={confirmDelete ? 'Click again to confirm' : 'Delete permanently'}
          className={`p-1 transition-colors rounded ${
            confirmDelete
              ? 'text-red-400 bg-red-900/30'
              : 'text-slate-600 hover:text-red-400'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function ArchivePanel({ onClose }: ArchivePanelProps) {
  const { workspaces } = useAimStore()

  // Collect all archived sessions, grouped by workspace
  const groups = workspaces
    .map((w) => ({
      workspace: w,
      archived: w.sessions.filter((s) => s.archived),
    }))
    .filter((g) => g.archived.length > 0)

  const totalArchived = groups.reduce((n, g) => n + g.archived.length, 0)

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="w-[480px] h-full bg-[#131620] border-l border-slate-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">Archived Sessions</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalArchived} session{totalArchived !== 1 ? 's' : ''} · worktrees preserved
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {groups.length === 0 ? (
            <p className="text-sm text-slate-600 text-center mt-12">No archived sessions.</p>
          ) : (
            groups.map(({ workspace, archived }) => (
              <div key={workspace.id} className="mb-4">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide px-3 mb-1">
                  {workspace.name}
                </p>
                <div className="space-y-0.5">
                  {archived.map((s) => (
                    <ArchivedRow key={s.id} session={s} workspaceName={workspace.name} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
