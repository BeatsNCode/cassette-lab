import { create } from 'zustand'
import type { SyncStatus, SyncProgress } from '../../../preload/index.d'

interface SyncState {
  statuses: Record<string, SyncStatus>
  progress: Record<string, SyncProgress>
  fetchStatus: (id: string) => Promise<void>
  upload: (id: string) => Promise<void>
  download: (id: string) => Promise<void>
  resolveConflict: (id: string, resolution: 'local' | 'cloud') => Promise<void>
}

export const useSyncStore = create<SyncState>((set) => ({
  statuses: {},
  progress: {},

  fetchStatus: async (id) => {
    const status = await window.api.sync.getStatus(id)
    set((state) => ({ statuses: { ...state.statuses, [id]: status } }))
  },

  upload: async (id) => {
    window.api.sync.onProgress((data) => {
      set((state) => ({ progress: { ...state.progress, [data.projectId]: data } }))
    })
    try {
      await window.api.sync.upload(id)
      const status = await window.api.sync.getStatus(id)
      set((state) => ({
        statuses: { ...state.statuses, [id]: status },
        progress: { ...state.progress, [id]: undefined as unknown as SyncProgress }
      }))
    } finally {
      window.api.sync.offProgress()
    }
  },

  download: async (id) => {
    window.api.sync.onProgress((data) => {
      set((state) => ({ progress: { ...state.progress, [data.projectId]: data } }))
    })
    try {
      await window.api.sync.download(id)
      const status = await window.api.sync.getStatus(id)
      set((state) => ({
        statuses: { ...state.statuses, [id]: status },
        progress: { ...state.progress, [id]: undefined as unknown as SyncProgress }
      }))
    } finally {
      window.api.sync.offProgress()
    }
  },

  resolveConflict: async (id, resolution) => {
    await window.api.sync.resolveConflict(id, resolution)
    const status = await window.api.sync.getStatus(id)
    set((state) => ({ statuses: { ...state.statuses, [id]: status } }))
  }
}))
