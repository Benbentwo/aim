import { useState, useEffect, useCallback } from 'react'
import { useAimStore, AgentType, SessionState } from '../stores/sessions'

type Tab = 'open' | 'clone'

const agents: { id: AgentType; label: string }[] = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'OpenAI Codex' },
  { id: 'shell', label: 'Shell' },
]

interface AddRepositoryDialogProps {
  onClose: () => void
}

export default function AddRepositoryDialog({ onClose }: AddRepositoryDialogProps) {
  const { addWorkspace } = useAimStore()
  const [tab, setTab] = useState<Tab>('open')
  const [agent, setAgent] = useState<AgentType>('claude')

  // Open tab state
  const [localPath, setLocalPath] = useState('')
  const [openName, setOpenName] = useState('')

  // Clone tab state
  const [repoUrl, setRepoUrl] = useState('')
  const [cloneName, setCloneName] = useState('')
  const [cloneDest, setCloneDest] = useState('')
  const [reposBaseDir, setReposBaseDir] = useState('~/.aim/repos')

  const [loading, setLoading] = useState(false)
  const [cloneProgress, setCloneProgress] = useState('')
  const [error, setError] = useState('')

  // Load reposBaseDir from settings
  useEffect(() => {
    import('../../wailsjs/go/settings/Manager')
      .then(({ GetSettings }) => GetSettings())
      .then((s: any) => {
        if (s.reposBaseDir) setReposBaseDir(s.reposBaseDir)
        if (s.defaultAgent) setAgent(s.defaultAgent as AgentType)
      })
      .catch(() => {})
  }, [])

  // Auto-preview clone destination as user types URL
  useEffect(() => {
    if (!repoUrl.trim() || !reposBaseDir) {
      setCloneDest('')
      setCloneName('')
      return
    }
    const timer = setTimeout(() => {
      import('../../wailsjs/go/workspace/Manager')
        .then(({ CloneDestPreview }) => CloneDestPreview(repoUrl.trim(), reposBaseDir))
        .then((dest: string) => {
          setCloneDest(dest)
          const parts = dest.split('/')
          setCloneName((n) => n || parts[parts.length - 1] || '')
        })
        .catch(() => {
          setCloneDest('')
        })
    }, 400)
    return () => clearTimeout(timer)
  }, [repoUrl, reposBaseDir])

  const handleBrowse = useCallback(async () => {
    try {
      const { OpenDirectoryDialog } = await import('../../wailsjs/go/main/App')
      const path = await OpenDirectoryDialog('Select project directory')
      if (path) {
        setLocalPath(path)
        if (!openName) {
          const parts = path.split('/')
          setOpenName(parts[parts.length - 1] || '')
        }
      }
    } catch {
      setError('Could not open directory picker')
    }
  }, [openName])

  const handleCreate = useCallback(async () => {
    setError('')
    setLoading(true)

    try {
      const { AddWorkspace, CloneAndAddWorkspace, ListWorkspaces } =
        await import('../../wailsjs/go/workspace/Manager')

      let workspaceId: string

      if (tab === 'open') {
        if (!localPath) throw new Error('Select a directory')
        workspaceId = await AddWorkspace({
          path: localPath,
          name: openName || undefined,
          agent,
          repoUrl: '',
          reposBaseDir: '',
        })
      } else {
        if (!repoUrl.trim()) throw new Error('Enter a Git URL')
        setCloneProgress('Cloning repository…')
        workspaceId = await CloneAndAddWorkspace({
          repoUrl: repoUrl.trim(),
          reposBaseDir,
          name: cloneName || undefined,
          agent,
          path: '',
        })
        setCloneProgress('')
      }

      const workspaces = await ListWorkspaces()
      const ws = workspaces.find((w: any) => w.id === workspaceId)
      if (ws) {
        addWorkspace({
          id: ws.id,
          name: ws.name,
          path: ws.path,
          agent: ws.agent as AgentType,
          cloned: ws.cloned ?? false,
          expanded: true,
          sessions: (ws.sessions ?? []).map((s: any): SessionState => ({
            id: s.id,
            workspaceId: ws.id,
            name: s.name,
            agent: s.agent as AgentType,
            directory: s.directory,
            worktreePath: s.worktreePath ?? '',
            branch: s.branch ?? '',
            status: s.status ?? 'idle',
            archived: s.archived ?? false,
            archivedAt: s.archivedAt ?? undefined,
          })),
        })
      }

      onClose()
    } catch (err: any) {
      setCloneProgress('')
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [tab, localPath, openName, repoUrl, cloneName, reposBaseDir, agent, addWorkspace, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1e2e] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-white mb-5">Add Repository</h2>

        {/* Tab picker */}
        <div className="flex gap-1 p-1 bg-slate-800 rounded-lg mb-5">
          {(['open', 'clone'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'open' ? 'Open Project' : 'Clone from URL'}
            </button>
          ))}
        </div>

        {/* Agent picker */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Agent</label>
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
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'open' ? (
          <>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
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
            <div className="mb-5">
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Name</label>
              <input
                type="text"
                value={openName}
                onChange={(e) => setOpenName(e.target.value)}
                placeholder="my-project"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Git URL</label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            {cloneDest && (
              <div className="mb-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Cloning to:</p>
                <p className="text-xs text-slate-300 font-mono break-all">{cloneDest}</p>
              </div>
            )}
            <div className="mb-5">
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Name</label>
              <input
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="my-repo"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </>
        )}

        {cloneProgress && (
          <div className="flex items-center gap-2 mb-4 text-sm text-indigo-400">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.2"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            {cloneProgress}
          </div>
        )}

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

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
            {loading ? 'Adding…' : tab === 'clone' ? 'Clone & Open' : 'Open'}
          </button>
        </div>
      </div>
    </div>
  )
}
