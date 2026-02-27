import { useState, useEffect, useRef, useCallback } from 'react'
import type { LinearIssue } from '../../types/linear'
import { useLinearStore } from '../../stores/linear'
import { useSessionStore } from '../../stores/sessions'
import RepoPickerDialog from './RepoPickerDialog'

declare const window: Window & {
  runtime?: {
    EventsOn: (event: string, callback: (...args: unknown[]) => void) => void
    EventsOff: (event: string) => void
  }
}

type Step = 'detecting' | 'confirm' | 'manual' | 'creating' | 'done'

interface StartWorkspaceFlowProps {
  issue: LinearIssue
  onClose: () => void
}

export default function StartWorkspaceFlow({ issue, onClose }: StartWorkspaceFlowProps) {
  const [step, setStep] = useState<Step>('detecting')
  const [detectedRepos, setDetectedRepos] = useState<string[]>([])
  const [selectedRepos, setSelectedRepos] = useState<string[]>([])
  const [allRepos, setAllRepos] = useState<string[]>([])
  const [error, setError] = useState('')
  const [detectionSessionId, setDetectionSessionId] = useState<string | null>(null)
  const [terminalOutput, setTerminalOutput] = useState('')
  const terminalRef = useRef<HTMLDivElement>(null)
  const { bindTaskToWorkspace } = useLinearStore()
  const { addSession } = useSessionStore()

  // Scroll terminal to bottom on new output
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalOutput])

  // Start detection on mount
  useEffect(() => {
    startDetection()
  }, [])

  const startDetection = async () => {
    try {
      // Get settings for default repo dir
      const { GetSettings } = await import('../../../wailsjs/go/settings/Manager')
      const settings = await GetSettings()
      const baseDir = (settings as any).defaultRepoDir

      if (!baseDir) {
        setStep('manual')
        return
      }

      // List available repos
      const { ListRepoDirectories } = await import('../../../wailsjs/go/linear/Manager')
      const repos = await ListRepoDirectories(baseDir)
      setAllRepos(repos as string[])

      if (!repos || (repos as string[]).length === 0) {
        setStep('manual')
        return
      }

      // Prepare workspace directory
      const { PrepareWorkspace } = await import('../../../wailsjs/go/linear/Manager')
      const workspaceDir = await PrepareWorkspace(issue.identifier, baseDir)

      // Get detection prompt
      const { DetectReposPrompt } = await import('../../../wailsjs/go/linear/Manager')
      const prompt = await DetectReposPrompt(issue.title, issue.description || '', repos as string[])

      // Create a detection session
      const { CreateSession } = await import('../../../wailsjs/go/session/Manager')
      const sessionId = await CreateSession({
        name: `detect-${issue.identifier}`,
        agent: (settings as any).defaultAgent || 'claude',
        directory: workspaceDir as string,
        useWorktree: false,
        worktreePath: '',
        branch: '',
      } as any)

      setDetectionSessionId(sessionId as string)

      // Subscribe to session output
      window.runtime?.EventsOn(`session:data:${sessionId}`, (data: unknown) => {
        try {
          const decoded = atob(data as string)
          setTerminalOutput((prev) => prev + decoded)
        } catch {
          // ignore decode errors
        }
      })

      // Send the prompt after a short delay for the agent to start
      setTimeout(async () => {
        try {
          const { WriteToSession } = await import('../../../wailsjs/go/session/Manager')
          await WriteToSession(sessionId as string, prompt as string + '\n')
        } catch (err) {
          console.error('Failed to write prompt:', err)
        }
      }, 2000)

      // Set a timeout for detection
      setTimeout(() => {
        if (step === 'detecting') {
          parseDetectedRepos()
        }
      }, 30000)
    } catch (err: any) {
      setError(err?.message || 'Detection failed')
      setStep('manual')
    }
  }

  const parseDetectedRepos = useCallback(() => {
    // Parse terminal output for repo paths
    const lines = terminalOutput.split('\n')
    const detected: string[] = []
    for (const line of lines) {
      const trimmed = line.trim().replace(/^[-*]\s*/, '')
      if (trimmed.startsWith('/') && allRepos.includes(trimmed)) {
        detected.push(trimmed)
      }
    }

    if (detected.length > 0) {
      setDetectedRepos(detected)
      setSelectedRepos(detected)
      setStep('confirm')
    } else {
      setStep('manual')
    }
  }, [terminalOutput, allRepos])

  const handleConfirmRepos = async () => {
    if (selectedRepos.length === 0) return
    setStep('creating')

    try {
      const { GetSettings } = await import('../../../wailsjs/go/settings/Manager')
      const settings = await GetSettings()

      const sessionIds: string[] = []

      for (const repo of selectedRepos) {
        const { CreateSession } = await import('../../../wailsjs/go/session/Manager')
        const sessionId = await CreateSession({
          name: `${issue.identifier} — ${repo.split('/').pop()}`,
          agent: (settings as any).defaultAgent || 'claude',
          directory: repo,
          useWorktree: true,
          worktreePath: '',
          branch: `aim/linear/${issue.identifier.toLowerCase()}`,
        } as any)
        sessionIds.push(sessionId as string)
      }

      bindTaskToWorkspace(issue.id, {
        issueId: issue.id,
        issueIdentifier: issue.identifier,
        sessionIds,
        repos: selectedRepos,
        status: 'active',
      })

      // Clean up detection session
      if (detectionSessionId) {
        try {
          const { CloseSession } = await import('../../../wailsjs/go/session/Manager')
          await CloseSession(detectionSessionId)
        } catch {
          // ignore
        }
      }

      setStep('done')
      setTimeout(onClose, 1500)
    } catch (err: any) {
      setError(err?.message || 'Failed to create workspaces')
      setStep('confirm')
    }
  }

  const toggleRepo = (repo: string) => {
    setSelectedRepos((prev) =>
      prev.includes(repo) ? prev.filter((r) => r !== repo) : [...prev, repo]
    )
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detectionSessionId) {
        window.runtime?.EventsOff(`session:data:${detectionSessionId}`)
      }
    }
  }, [detectionSessionId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1e2e] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <div>
            <h2 className="text-sm font-semibold text-white">Start Workspace</h2>
            <p className="text-xs text-slate-500 mt-0.5">{issue.identifier} — {issue.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {step === 'detecting' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-sm text-slate-300">Detecting relevant repos...</span>
              </div>
              {/* Mini terminal */}
              <div
                ref={terminalRef}
                className="bg-[#0f1117] border border-slate-800 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs text-slate-400 whitespace-pre-wrap"
              >
                {terminalOutput || 'Starting agent...'}
              </div>
              <div className="flex justify-end mt-3 gap-2">
                <button
                  onClick={() => setStep('manual')}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Skip — pick manually
                </button>
                <button
                  onClick={parseDetectedRepos}
                  className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                >
                  Use results
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div>
              <p className="text-sm text-slate-300 mb-3">Detected repos — confirm selection:</p>
              <div className="space-y-1.5 mb-4">
                {allRepos.map((repo) => (
                  <label key={repo} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRepos.includes(repo)}
                      onChange={() => toggleRepo(repo)}
                      className="w-3.5 h-3.5 rounded border-slate-600 accent-indigo-500"
                    />
                    <span className="text-sm text-slate-300 font-mono truncate">{repo}</span>
                    {detectedRepos.includes(repo) && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-900 text-emerald-300 shrink-0">
                        detected
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setStep('manual')}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Browse more
                </button>
                <button
                  onClick={handleConfirmRepos}
                  disabled={selectedRepos.length === 0}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  Create {selectedRepos.length} workspace(s)
                </button>
              </div>
            </div>
          )}

          {step === 'manual' && (
            <RepoPickerDialog
              allRepos={allRepos}
              selectedRepos={selectedRepos}
              onSelect={setSelectedRepos}
              onConfirm={() => {
                if (selectedRepos.length > 0) {
                  handleConfirmRepos()
                }
              }}
              onBrowse={async () => {
                try {
                  const { OpenDirectoryDialog } = await import('../../../wailsjs/go/main/App')
                  const path = await OpenDirectoryDialog('Select Repository')
                  if (path) {
                    setAllRepos((prev) => prev.includes(path as string) ? prev : [...prev, path as string])
                    setSelectedRepos((prev) => [...prev, path as string])
                  }
                } catch {}
              }}
            />
          )}

          {step === 'creating' && (
            <div className="flex items-center gap-3 py-4">
              <span className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-sm text-slate-300">Creating workspaces...</span>
            </div>
          )}

          {step === 'done' && (
            <div className="flex items-center gap-3 py-4">
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-sm text-emerald-400">Workspaces created!</span>
            </div>
          )}

          {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
        </div>
      </div>
    </div>
  )
}
