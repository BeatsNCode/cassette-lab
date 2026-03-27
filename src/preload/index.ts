import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // ─── Scanner ───────────────────────────────────────────────
  scan: {
    start: (directory: string) => ipcRenderer.invoke('scan:start', directory),
    stop: () => ipcRenderer.invoke('scan:stop'),
    watchDirectory: (directory: string) => ipcRenderer.invoke('scan:watchDirectory', directory),
    onProgress: (callback: (progress: number) => void) =>
      ipcRenderer.on('scan:progress', (_event, progress) => callback(progress)),
    offProgress: () => ipcRenderer.removeAllListeners('scan:progress')
  },

  // ─── Projects ──────────────────────────────────────────────
  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    getById: (id: string) => ipcRenderer.invoke('projects:getById', id),
    update: (id: string, data: unknown) => ipcRenderer.invoke('projects:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
    openInDAW: (id: string) => ipcRenderer.invoke('projects:openInDAW', id),
    search: (query: string) => ipcRenderer.invoke('projects:search', query)
  },

  // ─── Sync ──────────────────────────────────────────────────
  sync: {
    upload: (id: string) => ipcRenderer.invoke('sync:upload', id),
    download: (id: string) => ipcRenderer.invoke('sync:download', id),
    getStatus: (id: string) => ipcRenderer.invoke('sync:getStatus', id),
    resolveConflict: (id: string, resolution: 'local' | 'cloud') =>
      ipcRenderer.invoke('sync:resolveConflict', id, resolution),
    onProgress: (callback: (data: unknown) => void) =>
      ipcRenderer.on('sync:progress', (_event, data) => callback(data)),
    offProgress: () => ipcRenderer.removeAllListeners('sync:progress')
  },

  // ─── Auth ──────────────────────────────────────────────────
  auth: {
    login: (email: string, password: string) => ipcRenderer.invoke('auth:login', email, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    signUp: (email: string, password: string) => ipcRenderer.invoke('auth:signUp', email, password),
    getSession: () => ipcRenderer.invoke('auth:getSession')
  },

  // ─── Sharing ───────────────────────────────────────────────
  share: {
    shareProject: (projectId: string, email: string, permission: 'view' | 'download') =>
      ipcRenderer.invoke('share:shareProject', projectId, email, permission),
    revokeShare: (projectId: string, email: string) =>
      ipcRenderer.invoke('share:revokeShare', projectId, email),
    getSharedWithMe: () => ipcRenderer.invoke('share:getSharedWithMe'),
    getProjectShares: (projectId: string) => ipcRenderer.invoke('share:getProjectShares', projectId)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}