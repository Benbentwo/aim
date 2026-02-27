import { useEffect, useState, useCallback } from 'react'
import './style.css'
import Sidebar from './components/Sidebar'
import Terminal from './components/Terminal'
import SessionHeader from './components/SessionHeader'
import AddRepositoryDialog from './components/AddRepositoryDialog'
import SettingsDialog from './components/Settings'
import { useAimStore, AgentType, SessionState, WorkspaceState } from './stores/sessions'

declare const window: Window & {
  runtime?: {
    EventsOn: (event: string, callback: (...args: unknown[]) => void) => void
    EventsOff: (event: string) => void
  }
}

/** Convert user's first prompt into a git branch name: aim/{slug} */
function slugifyToBranch(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-')
    .replace(/-+/g, '-')
    .replace(/-$/, '')
    .slice(0, 50)
  return `aim/${slug || 'session'}`
}

function App() {
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const {
    workspaces,
    activeSessionId,
    setWorkspaces,
    updateStatus,
    updateBranch,
    addSession,
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
            archived: s.archived ?? false,
            archivedAt: s.archivedAt ?? undefined,
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

  // [+ New session] — instantly creates a worktree with a temp branch, no dialog
  const handleNewSession = useCallback(async (workspaceId: string) => {
    const ws = workspaces.find((w) => w.id === workspaceId)
    if (!ws) return

    try {
      const { IsGitRepo, CreateWorktree } = await import('../wailsjs/go/worktree/Manager')
      const { CreateSession } = await import('../wailsjs/go/session/Manager')

      const isGit = await IsGitRepo(ws.path)
      // Random 6-char hex suffix for the temp branch
      const tmpSuffix = Math.random().toString(16).slice(2, 8)
      const tempBranch = `aim/tmp-${tmpSuffix}`

      let worktreePath = ''
      let branch = ''
      let directory = ws.path

      if (isGit) {
        worktreePath = await CreateWorktree(ws.path, tempBranch)
        branch = tempBranch
        directory = worktreePath
      }

      const id = await CreateSession({
        name: tempBranch,
        agent: ws.agent,
        directory,
        useWorktree: isGit,
        worktreePath,
        branch,
        workspaceId,
        repoPath: ws.path,
      })

      addSession({
        id,
        workspaceId,
        name: tempBranch,
        agent: ws.agent,
        directory,
        worktreePath,
        branch,
        status: 'idle',
        archived: false,
      })
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }, [workspaces, addSession])

  // After the user's first message, rename the temp branch to a slug of that message
  const handleFirstMessage = useCallback(async (sessionId: string, text: string) => {
    const session = allSessions.find((s) => s.id === sessionId)
    if (!session?.branch.startsWith('aim/tmp-')) return

    const newBranch = slugifyToBranch(text)
    try {
      const { RenameSessionBranch } = await import('../wailsjs/go/session/Manager')
      await RenameSessionBranch(sessionId, newBranch)
      updateBranch(sessionId, newBranch)
    } catch (err) {
      console.error('Failed to rename branch:', err)
    }
  }, [allSessions, updateBranch])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f1117]">
      <Sidebar
        onAddRepository={() => setShowAddRepo(true)}
        onSettings={() => setShowSettings(true)}
        onNewSession={handleNewSession}
        onArchivePanel={() => {}}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {activeSession ? (
          <>
            <SessionHeader session={activeSession} />
            <div className="flex-1 min-h-0">
              <Terminal
                sessionId={activeSession.id}
                onFirstMessage={(text) => handleFirstMessage(activeSession.id, text)}
              />
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
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
