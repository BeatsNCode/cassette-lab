import { ipcMain, BrowserWindow } from 'electron'
import { stat } from 'fs/promises'
import { basename, extname } from 'path'
import { randomUUID } from 'crypto'
import fg from 'fast-glob'
import { watch, FSWatcher } from 'chokidar'
import { getDb } from '../lib/db'

const DAW_EXTENSIONS: Record<string, string> = {
  '.als': 'Ableton Live',
  '.logicx': 'Logic Pro',
  '.flp': 'FL Studio',
  '.ptx': 'Pro Tools',
  '.ptf': 'Pro Tools',
  '.rpp': 'REAPER',
  '.cpr': 'Cubase',
  '.song': 'Studio One',
  '.reason': 'Reason'
}

const DAW_GLOB_PATTERNS = Object.keys(DAW_EXTENSIONS).map((ext) => `**/*${ext}`)

let scanAborted = false
let activeWatcher: FSWatcher | null = null

function getSender() {
  return BrowserWindow.getAllWindows()[0]?.webContents
}

async function upsertProject(filePath: string): Promise<void> {
  const ext = extname(filePath).toLowerCase()
  const dawType = DAW_EXTENSIONS[ext] ?? 'Unknown'
  const fileStat = await stat(filePath)
  const db = getDb()

  const existing = db.prepare('SELECT id FROM projects WHERE path = ?').get(filePath)

  if (existing) {
    db.prepare(
      'UPDATE projects SET size_bytes = @size_bytes, last_modified = @last_modified WHERE path = @path'
    ).run({
      size_bytes: fileStat.size,
      last_modified: fileStat.mtime.toISOString(),
      path: filePath
    })
  } else {
    db.prepare(`
      INSERT INTO projects (id, name, path, daw_type, size_bytes, last_modified, synced_at, cloud_id, tags, created_at)
      VALUES (@id, @name, @path, @daw_type, @size_bytes, @last_modified, NULL, NULL, '[]', @created_at)
    `).run({
      id: randomUUID(),
      name: basename(filePath, ext),
      path: filePath,
      daw_type: dawType,
      size_bytes: fileStat.size,
      last_modified: fileStat.mtime.toISOString(),
      created_at: new Date().toISOString()
    })
  }
}

export function registerScanHandlers(): void {
  ipcMain.handle('scan:start', async (_event, directory: string) => {
    scanAborted = false
    const sender = getSender()

    const files = await fg(DAW_GLOB_PATTERNS, {
      cwd: directory,
      absolute: true,
      followSymbolicLinks: false,
      suppressErrors: true
    })

    for (let i = 0; i < files.length; i++) {
      if (scanAborted) break
      await upsertProject(files[i])
      sender?.send('scan:progress', Math.round(((i + 1) / files.length) * 100))
    }
  })

  ipcMain.handle('scan:stop', () => {
    scanAborted = true
  })

  ipcMain.handle('scan:watchDirectory', (_event, directory: string) => {
    if (activeWatcher) activeWatcher.close()

    const patterns = Object.keys(DAW_EXTENSIONS).map((ext) => `${directory}/**/*${ext}`)

    activeWatcher = watch(patterns, { ignoreInitial: true, persistent: true })

    activeWatcher
      .on('add', (filePath) => upsertProject(filePath))
      .on('change', (filePath) => upsertProject(filePath))
      .on('unlink', (filePath) => {
        getDb().prepare('DELETE FROM projects WHERE path = ?').run(filePath)
      })
  })
}
