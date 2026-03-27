import { ipcMain, BrowserWindow } from 'electron'
import { createReadStream, createWriteStream } from 'fs'
import { stat, rm, readFile, writeFile } from 'fs/promises'
import { createGzip, createGunzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { supabase } from '../lib/supabase'
import { getDb } from '../lib/db'

const execFileAsync = promisify(execFile)
const BUCKET = 'projects'

interface ProjectRow {
  id: string
  path: string
  last_modified: string
  synced_at: string | null
  cloud_id: string | null
}

interface SyncStatusRow {
  status: string
  last_synced: string | null
  error: string | null
}

function getSender() {
  return BrowserWindow.getAllWindows()[0]?.webContents
}

function sendProgress(projectId: string, percent: number, stage: string) {
  getSender()?.send('sync:progress', { projectId, percent, stage })
}

function upsertSyncStatus(projectId: string, status: string, error?: string) {
  const now = status === 'synced' ? new Date().toISOString() : null
  getDb()
    .prepare(
      `INSERT INTO sync_status (project_id, status, last_synced, error)
       VALUES (@project_id, @status, @last_synced, @error)
       ON CONFLICT(project_id) DO UPDATE SET
         status = @status,
         last_synced = COALESCE(@last_synced, last_synced),
         error = @error`
    )
    .run({ project_id: projectId, status, last_synced: now, error: error ?? null })
}

async function zipPath(sourcePath: string): Promise<string> {
  const tempZip = join(tmpdir(), `${randomUUID()}.zip`)
  const isDir = (await stat(sourcePath)).isDirectory()

  if (isDir) {
    await execFileAsync('zip', ['-r', '-q', tempZip, '.'], { cwd: sourcePath })
  } else {
    await pipeline(createReadStream(sourcePath), createGzip(), createWriteStream(tempZip))
  }

  return tempZip
}

async function unzipToPath(zipFile: string, destPath: string, isDir: boolean): Promise<void> {
  if (isDir) {
    await execFileAsync('unzip', ['-q', '-o', zipFile, '-d', destPath])
  } else {
    await pipeline(createReadStream(zipFile), createGunzip(), createWriteStream(destPath))
  }
}

async function uploadProject(project: ProjectRow, userId: string): Promise<void> {
  const { id, path } = project
  let tempZip: string | null = null

  try {
    sendProgress(id, 0, 'zipping')
    tempZip = await zipPath(path)
    sendProgress(id, 30, 'uploading')

    const buffer = await readFile(tempZip)
    const storagePath = `${userId}/${id}.zip`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { upsert: true, contentType: 'application/zip' })
    if (error) throw error

    sendProgress(id, 100, 'uploading')

    const now = new Date().toISOString()
    getDb()
      .prepare('UPDATE projects SET synced_at = @synced_at, cloud_id = @cloud_id WHERE id = @id')
      .run({ synced_at: now, cloud_id: storagePath, id })
    upsertSyncStatus(id, 'synced')
  } finally {
    if (tempZip) await rm(tempZip, { force: true }).catch(() => {})
  }
}

async function downloadProject(project: ProjectRow): Promise<void> {
  const { id, path, cloud_id } = project
  if (!cloud_id) throw new Error(`Project has no cloud version: ${id}`)

  let tempZip: string | null = null

  try {
    sendProgress(id, 0, 'downloading')

    const { data, error } = await supabase.storage.from(BUCKET).download(cloud_id)
    if (error) throw error

    sendProgress(id, 60, 'unzipping')
    tempZip = join(tmpdir(), `${randomUUID()}.zip`)
    await writeFile(tempZip, Buffer.from(await data.arrayBuffer()))

    const isDir = await stat(path)
      .then((s) => s.isDirectory())
      .catch(() => false)
    await unzipToPath(tempZip, path, isDir)

    sendProgress(id, 100, 'unzipping')

    const fileStat = await stat(path)
    const now = new Date().toISOString()
    getDb()
      .prepare(
        'UPDATE projects SET synced_at = @synced_at, last_modified = @last_modified, size_bytes = @size_bytes WHERE id = @id'
      )
      .run({ synced_at: now, last_modified: fileStat.mtime.toISOString(), size_bytes: fileStat.size, id })
    upsertSyncStatus(id, 'synced')
  } finally {
    if (tempZip) await rm(tempZip, { force: true }).catch(() => {})
  }
}

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:upload', async (_event, id: string) => {
    const project = getDb()
      .prepare('SELECT id, path, last_modified, synced_at, cloud_id FROM projects WHERE id = ?')
      .get(id) as ProjectRow | undefined
    if (!project) throw new Error(`Project not found: ${id}`)

    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    upsertSyncStatus(id, 'pending')
    try {
      await uploadProject(project, session.user.id)
    } catch (err) {
      upsertSyncStatus(id, 'error', String(err))
      throw err
    }
  })

  ipcMain.handle('sync:download', async (_event, id: string) => {
    const project = getDb()
      .prepare('SELECT id, path, last_modified, synced_at, cloud_id FROM projects WHERE id = ?')
      .get(id) as ProjectRow | undefined
    if (!project) throw new Error(`Project not found: ${id}`)

    upsertSyncStatus(id, 'pending')
    try {
      await downloadProject(project)
    } catch (err) {
      upsertSyncStatus(id, 'error', String(err))
      throw err
    }
  })

  ipcMain.handle('sync:getStatus', async (_event, id: string) => {
    const db = getDb()
    const project = db
      .prepare('SELECT last_modified, synced_at, cloud_id FROM projects WHERE id = ?')
      .get(id) as Pick<ProjectRow, 'last_modified' | 'synced_at' | 'cloud_id'> | undefined
    if (!project) throw new Error(`Project not found: ${id}`)

    const row = db
      .prepare('SELECT status, last_synced, error FROM sync_status WHERE project_id = ?')
      .get(id) as SyncStatusRow | undefined

    if (!row || !project.synced_at) {
      return { status: 'pending', last_synced: null }
    }

    // Detect local changes made after last sync
    const localNewer = project.last_modified > project.synced_at
    if (localNewer && row.status === 'synced') {
      upsertSyncStatus(id, 'pending')
      return { status: 'pending', last_synced: row.last_synced }
    }

    return {
      status: row.status,
      last_synced: row.last_synced,
      ...(row.error ? { error: row.error } : {})
    }
  })

  ipcMain.handle('sync:resolveConflict', async (_event, id: string, resolution: 'local' | 'cloud') => {
    const project = getDb()
      .prepare('SELECT id, path, last_modified, synced_at, cloud_id FROM projects WHERE id = ?')
      .get(id) as ProjectRow | undefined
    if (!project) throw new Error(`Project not found: ${id}`)

    if (resolution === 'local') {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      await uploadProject(project, session.user.id)
    } else {
      await downloadProject(project)
    }
  })
}
