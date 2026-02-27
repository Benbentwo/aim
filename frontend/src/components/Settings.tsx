import { useState, useEffect } from 'react'
import { useLinearStore } from '../stores/linear'

interface SettingsData {
  defaultAgent: string
  defaultWorktree: boolean
  theme: string
  shellPath: string
  linearApiKey: string
  linearTeamId: string
  defaultRepoDir: string
  linearOAuthToken: string
  linearClientId: string
  reposBaseDir: string
  archiveWorktreeCleanupDays: number
}

interface SettingsProps {
  onClose: () => void
}

const agents = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'OpenAI Codex' },
  { id: 'shell', label: 'Shell' },
]

export default function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsData>({
    defaultAgent: 'claude',
    defaultWorktree: true,
    theme: 'dark',
    shellPath: '/bin/zsh',
    linearApiKey: '',
    linearTeamId: '',
    defaultRepoDir: '',
    linearOAuthToken: '',
    linearClientId: '',
    reposBaseDir: '',
    archiveWorktreeCleanupDays: 7,
  })
  const [saved, setSaved] = useState(false)
  const [linearStatus, setLinearStatus] = useState<'disconnected' | 'connected' | 'checking'>('checking')
  const linearStore = useLinearStore()

  useEffect(() => {
    import('../../wailsjs/go/settings/Manager')
      .then(({ GetSettings }) => GetSettings())
      .then((s: any) => {
        setSettings(s)
        if (s.linearOAuthToken || s.linearApiKey) {
          checkLinearConnection()
        } else {
          setLinearStatus('disconnected')
        }
      })
      .catch(() => setLinearStatus('disconnected'))
  }, [])

  const checkLinearConnection = async () => {
    try {
      const { IsConnected } = await import('../../wailsjs/go/linear/Manager')
      const connected = await IsConnected()
      setLinearStatus(connected ? 'connected' : 'disconnected')
    } catch {
      setLinearStatus('disconnected')
    }
  }

  const handleDisconnect = async () => {
    await linearStore.disconnect()
    setSettings((s) => ({ ...s, linearApiKey: '', linearOAuthToken: '' }))
    setLinearStatus('disconnected')
  }

  const handleSave = async () => {
    try {
      const { SaveSettings } = await import('../../wailsjs/go/settings/Manager')
      await SaveSettings(settings as any)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save settings failed:', err)
    }
  }

  const handleBrowseRepoDir = async () => {
    try {
      const { OpenDirectoryDialog } = await import('../../wailsjs/go/main/App')
      const path = await OpenDirectoryDialog('Select Default Repo Directory')
      if (path) {
        setSettings((s) => ({ ...s, defaultRepoDir: path as string }))
      }
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1e2e] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Default Agent */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
            Default Agent
          </label>
          <div className="grid grid-cols-3 gap-2">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => setSettings((s) => ({ ...s, defaultAgent: a.id }))}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  settings.defaultAgent === a.id
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Worktree default */}
        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.defaultWorktree}
              onChange={(e) => setSettings((s) => ({ ...s, defaultWorktree: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-600 accent-indigo-500"
            />
            <span className="text-sm text-slate-200">Create git worktree by default</span>
          </label>
        </div>

        {/* Shell path */}
        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
            Shell Path
          </label>
          <input
            type="text"
            value={settings.shellPath}
            onChange={(e) => setSettings((s) => ({ ...s, shellPath: e.target.value }))}
            placeholder="/bin/zsh"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Archive cleanup */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
            Clean up worktrees after (days)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              value={settings.archiveWorktreeCleanupDays}
              onChange={(e) => setSettings((s) => ({ ...s, archiveWorktreeCleanupDays: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
              className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-slate-500">0 = never</span>
          </div>
        </div>

        {/* Theme */}
        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
            Theme
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['dark', 'light'].map((t) => (
              <button
                key={t}
                onClick={() => setSettings((s) => ({ ...s, theme: t }))}
                className={`py-2 px-3 rounded-lg text-sm font-medium border capitalize transition-colors ${
                  settings.theme === t
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-700 my-5" />

        {/* Linear section */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-slate-400 uppercase tracking-wide">Linear</label>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                linearStatus === 'connected'
                  ? 'bg-emerald-900 text-emerald-300'
                  : linearStatus === 'checking'
                  ? 'bg-slate-700 text-slate-400'
                  : 'bg-slate-700 text-slate-500'
              }`}
            >
              {linearStatus === 'connected'
                ? settings.linearOAuthToken
                  ? 'Connected via OAuth'
                  : 'Connected via API Key'
                : linearStatus === 'checking'
                ? 'Checking...'
                : 'Not connected'}
            </span>
          </div>

          {linearStatus === 'connected' ? (
            <div className="space-y-2">
              {linearStore.me && (
                <p className="text-sm text-slate-300">
                  Signed in as <span className="font-medium text-slate-200">{linearStore.me.name}</span>
                  {linearStore.me.email && (
                    <span className="text-slate-500 ml-1">({linearStore.me.email})</span>
                  )}
                </p>
              )}
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-red-800 hover:text-red-400 rounded-lg text-xs text-slate-400 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">API Key</label>
              <input
                type="password"
                value={settings.linearApiKey}
                onChange={(e) => setSettings((s) => ({ ...s, linearApiKey: e.target.value }))}
                placeholder="lin_api_..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 mb-2"
              />
              <p className="text-[10px] text-slate-600 mb-3">Or use the Linear view to sign in with OAuth</p>
            </div>
          )}
        </div>

        {/* Default Repo Directory */}
        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
            Default Repo Directory
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.defaultRepoDir}
              onChange={(e) => setSettings((s) => ({ ...s, defaultRepoDir: e.target.value }))}
              placeholder="~/Projects"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleBrowseRepoDir}
              className="px-3 py-2 bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Browse
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-1">Base directory where Linear workspaces find repos</p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
