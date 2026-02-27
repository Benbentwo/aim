export interface LinearTeam {
  id: string
  name: string
  key: string
}

export interface LinearCycle {
  id: string
  name: string
  number: number
  startsAt: string
  endsAt: string
}

export interface LinearIssue {
  id: string
  identifier: string
  title: string
  description: string
  priority: number // 0=none, 1=urgent, 2=high, 3=medium, 4=low
  state: LinearState
  assignee: LinearUser | null
  labels: LinearLabel[]
  team: LinearTeam | null
  url: string
  createdAt: string
  updatedAt: string
}

export interface LinearState {
  id: string
  name: string
  color: string
  type: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
}

export interface LinearUser {
  id: string
  name: string
  email: string
}

export interface LinearLabel {
  id: string
  name: string
  color: string
}

export interface CycleIssuesResponse {
  cycle: LinearCycle | null
  issues: LinearIssue[]
  states: LinearState[]
}

export interface TaskWorkspaceBinding {
  issueId: string
  issueIdentifier: string
  sessionIds: string[]
  repos: string[]
  status: 'detecting' | 'ready' | 'active' | 'done'
}

export const priorityLabels: Record<number, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
}

export const priorityColors: Record<number, string> = {
  0: 'text-slate-500',
  1: 'text-red-400',
  2: 'text-orange-400',
  3: 'text-yellow-400',
  4: 'text-blue-400',
}

// State type ordering for kanban columns
export const stateTypeOrder: Record<string, number> = {
  backlog: 0,
  triage: 1,
  unstarted: 2,
  started: 3,
  completed: 4,
  canceled: 5,
}
