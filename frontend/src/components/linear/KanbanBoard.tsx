import { useMemo } from 'react'
import { useLinearStore } from '../../stores/linear'
import type { LinearIssue, LinearState } from '../../types/linear'
import { stateTypeOrder } from '../../types/linear'
import KanbanColumn from './KanbanColumn'

interface KanbanBoardProps {
  onIssueClick: (issue: LinearIssue) => void
}

export default function KanbanBoard({ onIssueClick }: KanbanBoardProps) {
  const {
    issues,
    states,
    filterPriority,
    filterAssignee,
    filterStateType,
    filterTeamKey,
    sortBy,
    me,
    bindings,
  } = useLinearStore()

  // Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (filterPriority !== null && issue.priority !== filterPriority) return false
      if (filterAssignee === 'me' && issue.assignee?.id !== me?.id) return false
      if (filterAssignee === 'unassigned' && issue.assignee !== null) return false
      if (filterStateType && issue.state.type !== filterStateType) return false
      if (filterTeamKey && issue.team?.key !== filterTeamKey) return false
      return true
    })
  }, [issues, filterPriority, filterAssignee, filterStateType, filterTeamKey, me])

  // Sort issues within columns
  const sortIssues = (issues: LinearIssue[]) => {
    return [...issues].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          // Urgent (1) first, then High (2), etc. 0 (none) goes last
          const pa = a.priority === 0 ? 5 : a.priority
          const pb = b.priority === 0 ? 5 : b.priority
          return pa - pb
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        default:
          return 0
      }
    })
  }

  // Group into columns by state NAME + TYPE (not ID) so cross-team states merge
  const columns = useMemo(() => {
    // Build a map keyed by "type:name" to merge states with the same name across teams
    const columnMap = new Map<string, { state: LinearState; issues: LinearIssue[] }>()

    // Seed with known states (use first occurrence for color)
    for (const s of states) {
      const key = `${s.type}:${s.name}`
      if (!columnMap.has(key)) {
        columnMap.set(key, { state: s, issues: [] })
      }
    }

    // Also include states from issues not in the states list
    for (const issue of filteredIssues) {
      const key = `${issue.state.type}:${issue.state.name}`
      if (!columnMap.has(key)) {
        columnMap.set(key, { state: issue.state, issues: [] })
      }
      columnMap.get(key)!.issues.push(issue)
    }

    // Sort columns by state type order, then by name
    const sorted = Array.from(columnMap.values()).sort((a, b) => {
      const typeA = stateTypeOrder[a.state.type] ?? 99
      const typeB = stateTypeOrder[b.state.type] ?? 99
      if (typeA !== typeB) return typeA - typeB
      return a.state.name.localeCompare(b.state.name)
    })

    // Filter out empty columns that aren't in the main flow
    const mainTypes = new Set(['backlog', 'unstarted', 'started', 'completed'])
    return sorted
      .filter((col) => col.issues.length > 0 || mainTypes.has(col.state.type))
      .map((col) => ({
        state: col.state,
        issues: sortIssues(col.issues),
      }))
  }, [filteredIssues, states, sortBy])

  const activeIssueIds = useMemo(
    () => new Set(Object.keys(bindings)),
    [bindings]
  )

  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-slate-600 select-none">
        <p className="text-sm">No issues found</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-x-auto">
      <div className="flex gap-3 p-4 min-h-full">
        {columns.map(({ state, issues }) => (
          <KanbanColumn
            key={`${state.type}:${state.name}`}
            state={state}
            issues={issues}
            onIssueClick={onIssueClick}
            activeIssueIds={activeIssueIds}
          />
        ))}
      </div>
    </div>
  )
}
