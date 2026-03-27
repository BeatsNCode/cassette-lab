import { ipcMain, shell } from 'electron'
import { getDb } from '../lib/db'

interface ProjectRow {
  id: string
  name: string
  path: string
  daw_type: string
  size_bytes: number
  last_modified: string
  synced_at: string | null
  cloud_id: string | null
  tags: string // JSON-encoded string[]
  created_at: string
}

const ALLOWED_UPDATE_COLUMNS = new Set([
  'name',
  'path',
  'daw_type',
  'size_bytes',
  'last_modified',
  'synced_at',
  'cloud_id',
  'tags'
])

function rowToProject(row: ProjectRow) {
  return { ...row, tags: JSON.parse(row.tags) as string[] }
}

export function registerProjectHandlers(): void {
  ipcMain.handle('projects:getAll', () => {
    const rows = getDb()
      .prepare('SELECT * FROM projects ORDER BY last_modified DESC')
      .all() as ProjectRow[]
    return rows.map(rowToProject)
  })

  ipcMain.handle('projects:getById', (_event, id: string) => {
    const row = getDb()
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(id) as ProjectRow | undefined
    if (!row) throw new Error(`Project not found: ${id}`)
    return rowToProject(row)
  })

  ipcMain.handle('projects:update', (_event, id: string, data: Record<string, unknown>) => {
    const { tags, ...rest } = data
    const fields: Record<string, unknown> = { ...rest }
    if (tags !== undefined) fields.tags = JSON.stringify(tags)

    const safeKeys = Object.keys(fields).filter((k) => ALLOWED_UPDATE_COLUMNS.has(k))
    if (safeKeys.length === 0) throw new Error('No valid fields to update')

    const sets = safeKeys.map((k) => `${k} = @${k}`).join(', ')
    const params = Object.fromEntries(safeKeys.map((k) => [k, fields[k]]))
    getDb()
      .prepare(`UPDATE projects SET ${sets} WHERE id = @id`)
      .run({ ...params, id })

    const updated = getDb()
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(id) as ProjectRow
    return rowToProject(updated)
  })

  ipcMain.handle('projects:delete', (_event, id: string) => {
    getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
  })

  ipcMain.handle('projects:openInDAW', async (_event, id: string) => {
    const row = getDb()
      .prepare('SELECT path FROM projects WHERE id = ?')
      .get(id) as Pick<ProjectRow, 'path'> | undefined
    if (!row) throw new Error(`Project not found: ${id}`)
    const error = await shell.openPath(row.path)
    if (error) throw new Error(`Failed to open project in DAW: ${error}`)
  })

  ipcMain.handle('projects:search', (_event, query: string) => {
    const rows = getDb()
      .prepare(
        'SELECT * FROM projects WHERE name LIKE ? OR path LIKE ? ORDER BY last_modified DESC'
      )
      .all(`%${query}%`, `%${query}%`) as ProjectRow[]
    return rows.map(rowToProject)
  })
}
