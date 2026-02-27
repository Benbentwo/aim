import type { LinearIssue } from '../../types/linear'
import { priorityLabels, priorityColors } from '../../types/linear'

function PriorityIcon({ priority }: { priority: number }) {
  const icons: Record<number, string> = {
    1: '!!!',
    2: '!!',
    3: '!',
    4: '-',
    0: '',
  }
  if (priority === 0) return null
  return (
    <span className={`text-[10px] font-bold ${priorityColors[priority]}`} title={priorityLabels[priority]}>
      {icons[priority]}
    </span>
  )
}

function AvatarInitials({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-700 text-[9px] font-semibold text-slate-300"
      title={name}
    >
      {initials}
    </span>
  )
}

function LabelDot({ color, name }: { color: string; name: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      title={name}
    />
  )
}

interface KanbanCardProps {
  issue: LinearIssue
  onClick: () => void
  hasWorkspace?: boolean
}

export default function KanbanCard({ issue, onClick, hasWorkspace }: KanbanCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-[#1a1e2e] border rounded-lg p-3 cursor-pointer hover:border-slate-600 transition-colors group ${
        hasWorkspace ? 'border-indigo-700' : 'border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-slate-500">{issue.identifier}</span>
        <PriorityIcon priority={issue.priority} />
        {hasWorkspace && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-900 text-indigo-300 font-medium">
            active
          </span>
        )}
      </div>
      <p className="text-sm text-slate-200 font-medium line-clamp-2 mb-2">{issue.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {issue.assignee && <AvatarInitials name={issue.assignee.name} />}
        {issue.labels.map((l) => (
          <LabelDot key={l.id} color={l.color} name={l.name} />
        ))}
      </div>
    </button>
  )
}
