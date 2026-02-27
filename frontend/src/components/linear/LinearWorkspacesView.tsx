import { useState, useEffect } from 'react'
import { useLinearStore, subscribeToLinearEvents, unsubscribeFromLinearEvents } from '../../stores/linear'
import type { LinearIssue } from '../../types/linear'
import LinearSetup from './LinearSetup'
import LinearFilters from './LinearFilters'
import KanbanBoard from './KanbanBoard'
import TaskDetailPanel from './TaskDetailPanel'
import StartWorkspaceFlow from './StartWorkspaceFlow'

export type ViewMode = 'my-issues' | 'cycle'

export default function LinearWorkspacesView() {
  const { isConnected, selectedTeamId, setConnected, setTeams, selectTeam, setCycleData } = useLinearStore()
  const [selectedIssue, setSelectedIssue] = useState<LinearIssue | null>(null)
  const [startingIssue, setStartingIssue] = useState<LinearIssue | null>(null)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('my-issues')

  // Check connection on mount
  useEffect(() => {
    checkConnection()
  }, [])

  // Subscribe to polling events
  useEffect(() => {
    subscribeToLinearEvents()
    return () => unsubscribeFromLinearEvents()
  }, [])

  // Fetch data based on view mode
  useEffect(() => {
    if (!isConnected) return

    if (viewMode === 'my-issues') {
      fetchMyIssues()
      startMyIssuesPolling()
    } else if (viewMode === 'cycle' && selectedTeamId) {
      fetchCycleData()
      startCyclePolling()
    }

    return () => {
      stopPolling()
    }
  }, [isConnected, viewMode, selectedTeamId])

  const checkConnection = async () => {
    try {
      const { IsConnected, GetMe, ListTeams } = await import('../../../wailsjs/go/linear/Manager')
      const connected = await IsConnected()
      if (!connected) return

      const me = await GetMe()
      setConnected(true, me as any)

      const teams = await ListTeams()
      setTeams(teams as any)

      // Load saved team ID for cycle view
      const { GetSettings } = await import('../../../wailsjs/go/settings/Manager')
      const settings = await GetSettings()
      const teamId = (settings as any).linearTeamId
      if (teamId) {
        selectTeam(teamId as string)
      } else if (teams && (teams as any).length === 1) {
        selectTeam((teams as any)[0].id)
      }
    } catch {
      // Not connected
    }
  }

  const fetchMyIssues = async () => {
    setLoading(true)
    try {
      const { GetMyIssues } = await import('../../../wailsjs/go/linear/Manager')
      const data = await GetMyIssues()
      if (data) {
        setCycleData(data as any)
      }
    } catch (err) {
      console.error('Failed to fetch my issues:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCycleData = async () => {
    if (!selectedTeamId) return
    setLoading(true)
    try {
      const { GetCycleIssues } = await import('../../../wailsjs/go/linear/Manager')
      const data = await GetCycleIssues(selectedTeamId)
      if (data) {
        setCycleData(data as any)
      }
    } catch (err) {
      console.error('Failed to fetch cycle data:', err)
    } finally {
      setLoading(false)
    }
  }

  const startMyIssuesPolling = async () => {
    try {
      const { StartMyIssuesPolling } = await import('../../../wailsjs/go/linear/Manager')
      await StartMyIssuesPolling(30)
    } catch {}
  }

  const startCyclePolling = async () => {
    if (!selectedTeamId) return
    try {
      const { StartPolling } = await import('../../../wailsjs/go/linear/Manager')
      await StartPolling(selectedTeamId, 30)
    } catch {}
  }

  const stopPolling = async () => {
    try {
      const { StopPolling } = await import('../../../wailsjs/go/linear/Manager')
      await StopPolling()
    } catch {}
  }

  const handleViewModeChange = async (mode: ViewMode) => {
    await stopPolling()
    setViewMode(mode)
  }

  const handleTeamSelect = async (teamId: string) => {
    selectTeam(teamId)
    try {
      const { GetSettings, SaveSettings } = await import('../../../wailsjs/go/settings/Manager')
      const settings = await GetSettings()
      await SaveSettings({ ...settings, linearTeamId: teamId } as any)
    } catch {}
  }

  // Not connected — show setup
  if (!isConnected) {
    return <LinearSetup />
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      <LinearFilters
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onTeamSelect={handleTeamSelect}
      />

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-sm">
              {viewMode === 'my-issues' ? 'Loading your issues...' : 'Loading sprint...'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          <KanbanBoard onIssueClick={setSelectedIssue} />
          {selectedIssue && (
            <TaskDetailPanel
              issue={selectedIssue}
              onClose={() => setSelectedIssue(null)}
              onStartWorkspace={(issue) => {
                setStartingIssue(issue)
                setSelectedIssue(null)
              }}
            />
          )}
        </div>
      )}

      {startingIssue && (
        <StartWorkspaceFlow
          issue={startingIssue}
          onClose={() => setStartingIssue(null)}
        />
      )}
    </div>
  )
}
