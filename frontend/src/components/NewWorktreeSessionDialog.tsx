import { useState, useCallback } from 'react'
import { useAimStore, AgentType, SessionState } from '../stores/sessions'

interface NewWorktreeSessionDialogProps {
  workspaceId: string
  workspacePath: string
  workspaceAgent: AgentType
  onClose: () => void
}

export default function NewWorktreeSessionDialog({
  workspaceId,
  workspacePath,
  workspaceAgent,
  onClose,
}: NewWorktreeSessionDialogProps) {
  const { addSession } = useAimStore()
  const [branch, setBranch] = useState('aim/')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = useCallback(async () => {
    if (!branch.trim()) { setError('Enter a branch name'); return }
    const sessionName = name.trim() || branch.trim()
    setLoading(true)
    setError('')

    try {
      const { CreateWorktree } = await import('../../wailsjs/go/worktree/Manager')
      const worktreePath = await CreateWorktree(workspacePath, branch.trim())

      const { CreateSession } = await import('../../wailsjs/go/session/Manager')
      const id = await CreateSession({
        name: sessionName,
        agent: workspaceAgent,
        directory: workspacePath,
        useWorktree: true,
        worktreePath,
        branch: branch.trim(),
      })

      addSession({
        id,
        workspaceId,
        name: sessionName,
        agent: workspaceAgent,
        directory: workspacePath,
        worktreePath,
        branch: branch.trim(),
        status: 'idle',
      })

      onClose()
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [branch, name, workspaceId, workspacePath, workspaceAgent, addSession, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1e2e] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-white mb-4">New Session</h2>
        <p className="text-xs text-slate-500 font-mono mb-4 truncate">{workspacePath}</p>

        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Branch</label>
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="aim/feature-name"
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
            Session name <span className="text-slate-600">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={branch || 'my-session'}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Creating…' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  )
}
