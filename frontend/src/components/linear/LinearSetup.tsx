import { useState, useEffect } from 'react'
import { useLinearStore } from '../../stores/linear'

declare const window: Window & {
  runtime?: {
    EventsOn: (event: string, callback: (...args: unknown[]) => void) => void
    EventsOff: (event: string) => void
  }
}

export default function LinearSetup() {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthWaiting, setOauthWaiting] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const { setConnected, setTeams, selectTeam } = useLinearStore()

  useEffect(() => {
    // Listen for OAuth completion
    window.runtime?.EventsOn('linear:oauth:complete', (data: unknown) => {
      const result = data as { me: { id: string; name: string; email: string }; token: string }
      if (result?.me && result?.token) {
        handleOAuthSuccess(result.me, result.token)
      }
    })

    window.runtime?.EventsOn('linear:oauth:error', (msg: unknown) => {
      setOauthWaiting(false)
      setError(typeof msg === 'string' ? msg : 'OAuth authorization failed')
    })

    return () => {
      window.runtime?.EventsOff('linear:oauth:complete')
      window.runtime?.EventsOff('linear:oauth:error')
      // Cancel OAuth if user navigates away during wait
      if (oauthWaiting) {
        import('../../../wailsjs/go/linear/Manager').then(({ CancelOAuth }) => CancelOAuth()).catch(() => {})
      }
    }
  }, [])

  const handleOAuthSuccess = async (me: { id: string; name: string; email: string }, token: string) => {
    try {
      // Save token to settings
      const { GetSettings, SaveSettings } = await import('../../../wailsjs/go/settings/Manager')
      const settings = await GetSettings()
      await SaveSettings({ ...settings, linearOAuthToken: token } as any)

      setConnected(true, me as any, 'oauth')

      // Fetch teams
      const { ListTeams } = await import('../../../wailsjs/go/linear/Manager')
      const teams = await ListTeams()
      setTeams(teams as any)

      if (teams && (teams as any).length === 1) {
        selectTeam((teams as any)[0].id)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to complete setup after OAuth')
    } finally {
      setOauthWaiting(false)
    }
  }

  const handleOAuth = async () => {
    setError('')
    setOauthWaiting(true)

    try {
      const { GetSettings } = await import('../../../wailsjs/go/settings/Manager')
      const settings = await GetSettings()
      const clientID = (settings as any).linearClientId || ''

      const { StartOAuth } = await import('../../../wailsjs/go/linear/Manager')
      await StartOAuth(clientID)
    } catch (err: any) {
      setOauthWaiting(false)
      setError(err?.message || 'Failed to start OAuth flow')
    }
  }

  const handleCancelOAuth = async () => {
    try {
      const { CancelOAuth } = await import('../../../wailsjs/go/linear/Manager')
      await CancelOAuth()
    } catch {}
    setOauthWaiting(false)
  }

  const handleApiKeyConnect = async () => {
    if (!apiKey.trim()) return
    setLoading(true)
    setError('')

    try {
      const { SetAPIKey } = await import('../../../wailsjs/go/linear/Manager')
      const me = await SetAPIKey(apiKey.trim())

      // Save to settings
      const { GetSettings, SaveSettings } = await import('../../../wailsjs/go/settings/Manager')
      const settings = await GetSettings()
      await SaveSettings({ ...settings, linearApiKey: apiKey.trim() } as any)

      setConnected(true, me as any, 'apikey')

      // Fetch teams
      const { ListTeams } = await import('../../../wailsjs/go/linear/Manager')
      const teams = await ListTeams()
      setTeams(teams as any)

      if (teams && (teams as any).length === 1) {
        selectTeam((teams as any)[0].id)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect. Check your API key.')
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center flex-1 text-slate-500 select-none">
      <div className="text-center max-w-sm">
        {/* Linear icon */}
        <svg
          className="mx-auto mb-4 text-slate-600"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="5" height="18" rx="1" />
          <rect x="10" y="3" width="5" height="18" rx="1" />
          <rect x="17" y="3" width="5" height="18" rx="1" />
        </svg>

        <p className="text-lg font-semibold text-slate-400 mb-2">Connect Linear</p>
        <p className="text-sm mb-6">Sign in to see your sprint board and manage tasks.</p>

        {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

        {/* OAuth waiting state */}
        {oauthWaiting ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Waiting for authorization...
            </div>
            <p className="text-xs text-slate-600">Complete sign-in in your browser</p>
            <button
              onClick={handleCancelOAuth}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Primary: OAuth button */}
            <button
              onClick={handleOAuth}
              className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 100 100" fill="currentColor">
                <path d="M49.97 0C22.37 0 0 22.37 0 49.97c0 16.52 8.07 31.15 20.47 40.2a50.16 50.16 0 0 0 14.02 7.1c.76.22 1.55.35 2.35.45.17.02.33.04.5.05l.53.04c.36.02.72.03 1.08.03h22.08c.36 0 .72-.01 1.08-.03l.53-.04c.17-.01.33-.03.5-.05.8-.1 1.59-.23 2.35-.45a50.16 50.16 0 0 0 14.02-7.1C91.93 81.12 100 66.49 100 49.97 100 22.37 77.63 0 49.97 0zm30.9 72.88L52.8 17.63c-.78-1.56-3.04-1.56-3.82 0L20.36 72.88c-.85 1.69.66 3.57 2.48 2.83l26.26-10.75c.56-.23 1.2-.23 1.76 0l26.53 10.75c1.82.74 3.33-1.14 2.48-2.83z" />
              </svg>
              Sign in with Linear
            </button>

            {/* Secondary: API key section */}
            <div>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                {showApiKey ? 'Hide API key option' : 'Or use an API key'}
              </button>

              {showApiKey && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] text-slate-600">
                    Get your API key from Linear Settings &gt; API &gt; Personal API keys
                  </p>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApiKeyConnect()}
                    placeholder="lin_api_..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleApiKeyConnect}
                    disabled={loading || !apiKey.trim()}
                    className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    {loading ? 'Connecting...' : 'Connect with API Key'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
