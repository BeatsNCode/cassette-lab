import { create } from 'zustand'
import type { Project } from '../../../preload/index.d'

interface ProjectState {
  projects: Project[]
  loading: boolean
  scanProgress: number | null
  fetchAll: () => Promise<void>
  scan: (directory: string) => Promise<void>
  stopScan: () => Promise<void>
  search: (query: string) => Promise<void>
  update: (id: string, data: Partial<Project>) => Promise<void>
  remove: (id: string) => Promise<void>
  openInDAW: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  scanProgress: null,

  fetchAll: async () => {
    set({ loading: true })
    try {
      const projects = await window.api.projects.getAll()
      set({ projects })
    } finally {
      set({ loading: false })
    }
  },

  scan: async (directory) => {
    set({ scanProgress: 0 })
    window.api.scan.onProgress((progress) => set({ scanProgress: progress }))
    try {
      await window.api.scan.start(directory)
      await get().fetchAll()
    } finally {
      window.api.scan.offProgress()
      set({ scanProgress: null })
    }
  },

  stopScan: async () => {
    await window.api.scan.stop()
    window.api.scan.offProgress()
    set({ scanProgress: null })
  },

  search: async (query) => {
    set({ loading: true })
    try {
      const projects = query.trim()
        ? await window.api.projects.search(query)
        : await window.api.projects.getAll()
      set({ projects })
    } finally {
      set({ loading: false })
    }
  },

  update: async (id, data) => {
    const updated = await window.api.projects.update(id, data)
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? updated : p))
    }))
  },

  remove: async (id) => {
    await window.api.projects.delete(id)
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }))
  },

  openInDAW: async (id) => {
    await window.api.projects.openInDAW(id)
  }
}))
