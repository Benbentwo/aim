import type { LinearIssue, LinearState } from '../../types/linear'
import KanbanCard from './KanbanCard'

interface KanbanColumnProps {
  state: LinearState
  issues: LinearIssue[]
  onIssueClick: (issue: LinearIssue) => void
  activeIssueIds: Set<string>
}

export default function KanbanColumn({ state, issues, onIssueClick, activeIssueIds }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: state.color }}
        />
        <span className="text-sm font-medium text-slate-300">{state.name}</span>
        <span className="text-xs text-slate-600 font-mono">{issues.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto space-y-2 px-1.5 pb-4">
        {issues.map((issue) => (
          <KanbanCard
            key={issue.id}
            issue={issue}
            onClick={() => onIssueClick(issue)}
            hasWorkspace={activeIssueIds.has(issue.id)}
          />
        ))}
        {issues.length === 0 && (
          <p className="text-xs text-slate-700 text-center mt-4 px-2">No issues</p>
        )}
      </div>
    </div>
  )
}
