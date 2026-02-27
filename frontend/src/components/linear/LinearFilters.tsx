import { useMemo } from 'react'
import { useLinearStore } from '../../stores/linear'
import { priorityLabels } from '../../types/linear'
import type { ViewMode } from './LinearWorkspacesView'

interface LinearFiltersProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onTeamSelect: (teamId: string) => void
}

export default function LinearFilters({ viewMode, onViewModeChange, onTeamSelect }: LinearFiltersProps) {
  const {
    issues,
    filterPriority,
    filterAssignee,
    filterStateType,
    filterTeamKey,
    sortBy,
    setFilter,
    setSortBy,
    cycle,
    teams,
    selectedTeamId,
  } = useLinearStore()

  // Extract unique team keys from current issues for the project filter
  const issueTeams = useMemo(() => {
    const teamMap = new Map<string, string>() // key -> name
    for (const issue of issues) {
      if (issue.team) {
        teamMap.set(issue.team.key, issue.team.name)
      }
    }
    return Array.from(teamMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
  }, [issues])

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-[#131620] no-select">
      {/* View mode switcher */}
      <div className="flex items-center bg-slate-800 rounded-lg p-0.5 mr-1">
        <button
          onClick={() => onViewModeChange('my-issues')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            viewMode === 'my-issues'
              ? 'bg-slate-700 text-slate-200'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          My Issues
        </button>
        <button
          onClick={() => onViewModeChange('cycle')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            viewMode === 'cycle'
              ? 'bg-slate-700 text-slate-200'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Sprint
        </button>
      </div>

      {/* Team selector (only for cycle view) */}
      {viewMode === 'cycle' && teams.length > 0 && (
        <select
          value={selectedTeamId ?? ''}
          onChange={(e) => e.target.value && onTeamSelect(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 px-1.5 py-1 focus:outline-none focus:border-indigo-500"
        >
          {!selectedTeamId && <option value="">Select team...</option>}
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      {/* Sprint label */}
      {viewMode === 'cycle' && cycle && (
        <span className="text-xs text-slate-500 font-medium">
          Sprint {cycle.number}
          {cycle.name ? ` — ${cycle.name}` : ''}
        </span>
      )}

      {/* Separator */}
      <div className="w-px h-4 bg-slate-700" />

      {/* Project filter (from issue teams) */}
      {issueTeams.length > 1 && (
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-slate-600">Project</label>
          <select
            value={filterTeamKey ?? ''}
            onChange={(e) => setFilter('filterTeamKey', e.target.value || null)}
            className="bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 px-1.5 py-1 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All</option>
            {issueTeams.map(([key, name]) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <label className="text-[10px] uppercase tracking-wide text-slate-600">Priority</label>
        <select
          value={filterPriority ?? ''}
          onChange={(e) => setFilter('filterPriority', e.target.value ? Number(e.target.value) : null)}
          className="bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 px-1.5 py-1 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All</option>
          {[1, 2, 3, 4, 0].map((p) => (
            <option key={p} value={p}>
              {priorityLabels[p]}
            </option>
          ))}
        </select>
      </div>

      {/* Assignee filter only in cycle mode (my-issues is already filtered to me) */}
      {viewMode === 'cycle' && (
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-slate-600">Assignee</label>
          <select
            value={filterAssignee ?? ''}
            onChange={(e) => setFilter('filterAssignee', e.target.value || null)}
            className="bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 px-1.5 py-1 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <label className="text-[10px] uppercase tracking-wide text-slate-600">State</label>
        <select
          value={filterStateType ?? ''}
          onChange={(e) => setFilter('filterStateType', e.target.value || null)}
          className="bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 px-1.5 py-1 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All</option>
          <option value="backlog">Backlog</option>
          <option value="unstarted">Todo</option>
          <option value="started">In Progress</option>
          <option value="completed">Done</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <label className="text-[10px] uppercase tracking-wide text-slate-600">Sort</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 px-1.5 py-1 focus:outline-none focus:border-indigo-500"
        >
          <option value="priority">Priority</option>
          <option value="updated">Updated</option>
          <option value="created">Created</option>
        </select>
      </div>
    </div>
  )
}
