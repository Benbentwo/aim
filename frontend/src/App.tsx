import { useEffect, useState } from 'react'
import './style.css'
import Sidebar from './components/Sidebar'
import Terminal from './components/Terminal'
import SessionHeader from './components/SessionHeader'
import NewSessionDialog from './components/NewSessionDialog'
import SettingsDialog from './components/Settings'
import { useSessionStore } from './stores/sessions'

declare const window: Window & {
  runtime?: {
    EventsOn: (event: string, callback: (...args: unknown[]) => void) => void
    EventsOff: (event: string) => void
  }
}

function App() {
  const [showNewSession, setShowNewSession] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { sessions, activeSessionId, setSessions, updateStatus } = useSessionStore()
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null

  // Load persisted sessions on mount
  useEffect(() => {
    import('../wailsjs/go/session/Manager')
      .then(({ ListSessions }) => ListSessions())
      .then((list) => {
        if (list && list.length > 0) {
          setSessions(list as any)
        }
      })
      .catch(() => {})
  }, [setSessions])

  // Subscribe to status events for all sessions
  useEffect(() => {
    sessions.forEach((s) => {
      window.runtime?.EventsOn(`session:status:${s.id}`, (status: unknown) => {
        updateStatus(s.id, status as any)
      })
    })
    return () => {
      sessions.forEach((s) => {
        window.runtime?.EventsOff(`session:status:${s.id}`)
      })
    }
  }, [sessions.length, updateStatus])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f1117]">
      {/* Sidebar */}
      <Sidebar
        onNewSession={() => setShowNewSession(true)}
        onSettings={() => setShowSettings(true)}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {activeSession ? (
          <>
            <SessionHeader session={activeSession} />
            <div className="flex-1 min-h-0">
              <Terminal sessionId={activeSession.id} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-slate-500 select-none">
            <div className="text-center">
              <p className="text-2xl font-semibold text-slate-400 mb-2">aim</p>
              <p className="text-sm">AI Manager — multi-session terminal for Claude Code &amp; Codex</p>
              <button
                className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                onClick={() => setShowNewSession(true)}
              >
                + New Session
              </button>
            </div>
          </div>
        )}
      </div>

      {showNewSession && (
        <NewSessionDialog onClose={() => setShowNewSession(false)} />
      )}

      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

export default App
