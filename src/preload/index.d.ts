import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      scan: {
        start: (directory: string) => Promise<void>
        stop: () => Promise<void>
        watchDirectory: (directory: string) => Promise<void>
        onProgress: (callback: (progress: number) => void) => void
        offProgress: () => void
      }
      projects: {
        getAll: () => Promise<Project[]>
        getById: (id: string) => Promise<Project>
        update: (id: string, data: Partial<Project>) => Promise<Project>
        delete: (id: string) => Promise<void>
        openInDAW: (id: string) => Promise<void>
        search: (query: string) => Promise<Project[]>
      }
      sync: {
        upload: (id: string) => Promise<void>
        download: (id: string) => Promise<void>
        getStatus: (id: string) => Promise<SyncStatus>
        resolveConflict: (id: string, resolution: 'local' | 'cloud') => Promise<void>
        onProgress: (callback: (data: SyncProgress) => void) => void
        offProgress: () => void
      }
      auth: {
        login: (email: string, password: string) => Promise<User>
        logout: () => Promise<void>
        signUp: (email: string, password: string) => Promise<User>
        getSession: () => Promise<User | null>
      }
      share: {
        shareProject: (
          projectId: string,
          email: string, 
          permission: 'view' | 'download'
        ) => Promise<void>
        revokeShare: (projectId: string, email: string) => Promise<void>
        getSharedWithMe: () => Promise<Project[]>
        getProjectShares: (projectId: string) => Promise<Share[]>
      }
    }
  }
}

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  path: string
  daw_type: string
  size_bytes: number
  last_modified: string
  synced_at: string | null
  cloud_id: string | null
  tags: string[]
  created_at: string
}

export interface User {
  id: string
  email: string
}

export interface SyncStatus {
  status: 'synced' | 'pending' | 'error' | 'conflict'
  last_synced: string | null
  error?: string
}

export interface SyncProgress {
  projectId: string
  percent: number
  stage: 'uploading' | 'downloading' | 'zipping' | 'unzipping'
}

export interface Share {
  id: string
  project_id: string
  owner_id: string
  shared_with_email: string
  permission: 'view' | 'download'
  created_at: string
}