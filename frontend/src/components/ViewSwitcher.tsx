import { useNavigationStore, ViewType } from '../stores/navigation'

const views: { id: ViewType; label: string; icon: JSX.Element }[] = [
  {
    id: 'dashboard',
    label: 'Agent Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="6" width="4" height="15" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    id: 'workspaces',
    label: 'Workspaces',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <polyline points="7 15 10 12 13 15" />
        <line x1="16" y1="12" x2="16" y2="12.01" />
      </svg>
    ),
  },
  {
    id: 'linear',
    label: 'Linear',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="5" height="18" rx="1" />
        <rect x="10" y="3" width="5" height="18" rx="1" />
        <rect x="17" y="3" width="5" height="18" rx="1" />
      </svg>
    ),
  },
]

export default function ViewSwitcher() {
  const { activeView, setView } = useNavigationStore()

  return (
    <div className="absolute top-0 left-0 right-0 h-10 flex items-center pl-[78px] gap-1 no-select z-10">
      {views.map((v) => (
        <button
          key={v.id}
          onClick={() => setView(v.id)}
          className={`p-1.5 rounded-md transition-colors ${
            activeView === v.id
              ? 'text-indigo-400 bg-slate-800'
              : 'text-slate-600 hover:text-slate-400'
          }`}
          title={v.label}
        >
          {v.icon}
        </button>
      ))}
    </div>
  )
}
