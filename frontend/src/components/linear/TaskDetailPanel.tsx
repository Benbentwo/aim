import { useState } from 'react'
import type { LinearIssue } from '../../types/linear'
import { priorityLabels, priorityColors } from '../../types/linear'
import { useLinearStore } from '../../stores/linear'

interface TaskDetailPanelProps {
  issue: LinearIssue
  onClose: () => void
  onStartWorkspace: (issue: LinearIssue) => void
}

export default function TaskDetailPanel({ issue, onClose, onStartWorkspace }: TaskDetailPanelProps) {
  const { bindings } = useLinearStore()
  const binding = bindings[issue.id]

  return (
    <div className="w-[400px] shrink-0 border-l border-slate-800 bg-[#131620] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <span className="text-xs font-mono text-slate-500">{issue.identifier}</span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Title */}
        <h2 className="text-base font-semibold text-slate-200">{issue.title}</h2>

        {/* Meta */}
        <div className="flex flex-wrap gap-2">
          {/* State */}
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: issue.state.color }}
            />
            {issue.state.name}
          </span>

          {/* Priority */}
          <span className={`text-xs px-2 py-1 rounded bg-slate-800 ${priorityColors[issue.priority]}`}>
            {priorityLabels[issue.priority]}
          </span>

          {/* Assignee */}
          {issue.assignee && (
            <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">
              {issue.assignee.name}
            </span>
          )}
        </div>

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {issue.labels.map((l) => (
              <span
                key={l.id}
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: l.color + '20',
                  color: l.color,
                  border: `1px solid ${l.color}40`,
                }}
              >
                {l.name}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {issue.description && (
          <div className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
            {issue.description}
          </div>
        )}

        {/* Linear link */}
        {issue.url && (
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open in Linear
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-slate-800">
        {binding ? (
          <div className="text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              Workspace active — {binding.repos.length} repo(s)
            </span>
          </div>
        ) : (
          <button
            onClick={() => onStartWorkspace(issue)}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Start Workspace
          </button>
        )}
      </div>
    </div>
  )
}
