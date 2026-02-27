import { create } from 'zustand'

export type ViewType = 'dashboard' | 'workspaces' | 'linear'

interface NavigationStore {
  activeView: ViewType
  setView: (view: ViewType) => void
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  activeView: 'workspaces',
  setView: (view) => set({ activeView: view }),
}))
