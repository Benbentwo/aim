import { useState, useEffect } from 'react'

interface SettingsData {
  defaultAgent: string
  defaultWorktree: boolean
  theme: string
  shellPath: string
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
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    import('../../wailsjs/go/settings/Manager')
      .then(({ GetSettings }) => GetSettings())
      .then((s: any) => setSettings(s))
      .catch(() => {})
  }, [])

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1e2e] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
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
