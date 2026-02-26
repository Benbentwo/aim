import { useState, useEffect } from 'react'
import { useSessionStore, AgentType } from '../stores/sessions'

interface NewSessionDialogProps {
  onClose: () => void
}

const agents: { id: AgentType; label: string; description: string }[] = [
  { id: 'claude', label: 'Claude Code', description: 'Anthropic Claude Code CLI' },
  { id: 'codex', label: 'OpenAI Codex', description: 'OpenAI Codex CLI' },
  { id: 'shell', label: 'Shell', description: 'Generic shell ($SHELL)' },
]

export default function NewSessionDialog({ onClose }: NewSessionDialogProps) {
  const { addSession } = useSessionStore()

  const [agent, setAgent] = useState<AgentType>('claude')
  const [directory, setDirectory] = useState('')
  const [branch, setBranch] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [useWorktree, setUseWorktree] = useState(true)
  const [isGitRepo, setIsGitRepo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Check default worktree setting on mount
  useEffect(() => {
    import('../../wailsjs/go/settings/Manager')
      .then(({ GetSettings }) => GetSettings())
      .then((s: any) => {
        setUseWorktree(s.defaultWorktree ?? true)
        setAgent(s.defaultAgent ?? 'claude')
      })
      .catch(() => {})
  }, [])

  // Check if selected directory is a git repo
  useEffect(() => {
    if (!directory) {
      setIsGitRepo(false)
      return
    }
    import('../../wailsjs/go/worktree/Manager')
      .then(({ IsGitRepo }) => IsGitRepo(directory))
      .then((result: boolean) => {
        setIsGitRepo(result)
        if (!result) setUseWorktree(false)
      })
      .catch(() => setIsGitRepo(false))
  }, [directory])

  const handleBrowse = async () => {
    try {
      const { OpenDirectoryDialog } = await import('../../wailsjs/go/main/App')
      const path = await OpenDirectoryDialog('Select working directory')
      if (path) {
        setDirectory(path)
        // Auto-suggest session name from dir name
        const parts = path.split('/')
        const dirName = parts[parts.length - 1] || path
        if (!sessionName) setSessionName(dirName)
        if (!branch) setBranch(`aim/${dirName}`)
      }
    } catch {
      setError('Could not open directory picker')
    }
  }

  const handleCreate = async () => {
    if (!directory) {
      setError('Please select a working directory')
      return
    }
    if (!sessionName.trim()) {
      setError('Please enter a session name')
      return
    }

    setLoading(true)
    setError('')

    try {
      let worktreePath = ''

      if (useWorktree && isGitRepo && branch) {
        const { CreateWorktree } = await import('../../wailsjs/go/worktree/Manager')
        worktreePath = await CreateWorktree(directory, branch)
      }

      const { CreateSession } = await import('../../wailsjs/go/session/Manager')
      const id = await CreateSession({
        name: sessionName.trim(),
        agent,
        directory,
        useWorktree: useWorktree && isGitRepo,
        worktreePath,
        branch: useWorktree && isGitRepo ? branch : '',
      })

      addSession({
        id,
        name: sessionName.trim(),
        agent,
        directory,
        worktreePath,
        branch: useWorktree && isGitRepo ? branch : '',
        status: 'idle',
      })

      onClose()
    } catch (err: any) {
      setError(err?.message ?? String(err) ?? 'Failed to create session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1e2e] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-white mb-5">New Session</h2>

        {/* Agent picker */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
            Agent
          </label>
          <div className="grid grid-cols-3 gap-2">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => setAgent(a.id)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  agent === a.id
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
                title={a.description}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Directory */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
            Working Directory
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              placeholder="/path/to/project"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleBrowse}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
            >
              Browse
            </button>
          </div>
        </div>

        {/* Worktree toggle */}
        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useWorktree && isGitRepo}
              disabled={!isGitRepo}
              onChange={(e) => setUseWorktree(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 accent-indigo-500"
            />
            <span className={`text-sm ${isGitRepo ? 'text-slate-200' : 'text-slate-600'}`}>
              Create git worktree for this session
            </span>
            {!isGitRepo && directory && (
              <span className="text-xs text-slate-600">(not a git repo)</span>
            )}
          </label>
        </div>

        {/* Branch name */}
        {useWorktree && isGitRepo && (
          <div className="mb-4">
            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
              Branch Name
            </label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="aim/feature-name"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        )}

        {/* Session name */}
        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
            Session Name
          </label>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="My session"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
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
