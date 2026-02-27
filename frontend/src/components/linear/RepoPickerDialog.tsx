interface RepoPickerDialogProps {
  allRepos: string[]
  selectedRepos: string[]
  onSelect: (repos: string[]) => void
  onConfirm: () => void
  onBrowse: () => void
}

export default function RepoPickerDialog({
  allRepos,
  selectedRepos,
  onSelect,
  onConfirm,
  onBrowse,
}: RepoPickerDialogProps) {
  const toggleRepo = (repo: string) => {
    onSelect(
      selectedRepos.includes(repo)
        ? selectedRepos.filter((r) => r !== repo)
        : [...selectedRepos, repo]
    )
  }

  return (
    <div>
      <p className="text-sm text-slate-300 mb-3">Select repositories for this task:</p>

      {allRepos.length > 0 ? (
        <div className="space-y-1.5 mb-4 max-h-64 overflow-y-auto">
          {allRepos.map((repo) => (
            <label key={repo} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedRepos.includes(repo)}
                onChange={() => toggleRepo(repo)}
                className="w-3.5 h-3.5 rounded border-slate-600 accent-indigo-500"
              />
              <span className="text-sm text-slate-300 font-mono truncate">
                {repo.split('/').pop()}
              </span>
              <span className="text-[10px] text-slate-600 truncate flex-1">{repo}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600 mb-4">
          No repos found. Set a default repo directory in Settings, or browse to add one.
        </p>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBrowse}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
        >
          + Browse
        </button>
        <button
          onClick={onConfirm}
          disabled={selectedRepos.length === 0}
          className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          Create {selectedRepos.length} workspace(s)
        </button>
      </div>
    </div>
  )
}
