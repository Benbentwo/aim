import { useEffect, useState, useCallback } from 'react'
import './style.css'
import Sidebar from './components/Sidebar'
import Terminal from './components/Terminal'
import SessionHeader from './components/SessionHeader'
import AddRepositoryDialog from './components/AddRepositoryDialog'
import NewWorktreeSessionDialog from './components/NewWorktreeSessionDialog'
import SettingsDialog from './components/Settings'
import { useAimStore, AgentType, SessionState, WorkspaceState } from './stores/sessions'

declare const window: Window & {
  runtime?: {
    EventsOn: (event: string, callback: (...args: unknown[]) => void) => void
    EventsOff: (event: string) => void
  }
}

function App() {
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [newSessionWorkspace, setNewSessionWorkspace] = useState<WorkspaceState | null>(null)

  const {
    workspaces,
    activeSessionId,
    activeWorkspaceId,
    setWorkspaces,
    updateStatus,
  } = useAimStore()

  // Flatten all sessions for lookup
  const allSessions = workspaces.flatMap((w) => w.sessions)
  const activeSession = allSessions.find((s) => s.id === activeSessionId) ?? null

  // Load workspaces from backend on mount
  useEffect(() => {
    import('../wailsjs/go/workspace/Manager')
      .then(({ ListWorkspaces }) => ListWorkspaces())
      .then((list: any[]) => {
        if (!list || list.length === 0) return
        const mapped: WorkspaceState[] = list.map((ws) => ({
          id: ws.id,
          name: ws.name,
          path: ws.path,
          agent: ws.agent as AgentType,
          cloned: ws.cloned ?? false,
          expanded: ws.sessions?.length > 0,
          sessions: (ws.sessions ?? []).map((s: any): SessionState => ({
            id: s.id,
            workspaceId: ws.id,
            name: s.name,
            agent: s.agent as AgentType,
            directory: s.directory,
            worktreePath: s.worktreePath ?? '',
            branch: s.branch ?? '',
            status: 'stopped',
          })),
        }))
        setWorkspaces(mapped)
      })
      .catch(() => {})
  }, [setWorkspaces])

  // Subscribe to status events
  useEffect(() => {
    allSessions.forEach((s) => {
      window.runtime?.EventsOn(`session:status:${s.id}`, (status: unknown) => {
        updateStatus(s.id, status as any)
      })
    })
    return () => {
      allSessions.forEach((s) => {
        window.runtime?.EventsOff(`session:status:${s.id}`)
      })
    }
  }, [allSessions.length, updateStatus])

  const handleNewSession = useCallback((workspaceId: string) => {
    const ws = workspaces.find((w) => w.id === workspaceId)
    if (ws) setNewSessionWorkspace(ws)
  }, [workspaces])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f1117]">
      <Sidebar
        onAddRepository={() => setShowAddRepo(true)}
        onSettings={() => setShowSettings(true)}
        onNewSession={handleNewSession}
      />

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
                onClick={() => setShowAddRepo(true)}
              >
                + Add repository
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddRepo && <AddRepositoryDialog onClose={() => setShowAddRepo(false)} />}

      {newSessionWorkspace && (
        <NewWorktreeSessionDialog
          workspaceId={newSessionWorkspace.id}
          workspacePath={newSessionWorkspace.path}
          workspaceAgent={newSessionWorkspace.agent}
          onClose={() => setNewSessionWorkspace(null)}
        />
      )}

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
