import { ipcMain } from 'electron'
import { supabase } from '../lib/supabase'
import { getDb } from '../lib/db'

interface CloudProjectRow {
  id: string
  owner_id: string
  name: string
  daw_type: string
  size_bytes: number
  last_modified: string
  tags: string // JSON
  created_at: string
  cloud_id: string | null
}

interface ShareRow {
  id: string
  project_id: string
  owner_id: string
  shared_with_email: string
  permission: 'view' | 'download'
  created_at: string
}

async function requireSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession()
  if (error) throw error
  if (!session) throw new Error('Not authenticated')
  return session
}

export function registerShareHandlers(): void {
  ipcMain.handle(
    'share:shareProject',
    async (_event, projectId: string, email: string, permission: 'view' | 'download') => {
      const session = await requireSession()

      // Mirror project metadata to Supabase so the recipient can see it
      const local = getDb()
        .prepare('SELECT * FROM projects WHERE id = ?')
        .get(projectId) as
        | { id: string; name: string; daw_type: string; size_bytes: number; last_modified: string; tags: string; created_at: string; cloud_id: string | null }
        | undefined
      if (!local) throw new Error(`Project not found: ${projectId}`)
      if (!local.cloud_id) throw new Error('Project must be synced before sharing')

      const { error: upsertError } = await supabase.from('cloud_projects').upsert({
        id: local.id,
        owner_id: session.user.id,
        name: local.name,
        daw_type: local.daw_type,
        size_bytes: local.size_bytes,
        last_modified: local.last_modified,
        tags: local.tags,
        created_at: local.created_at,
        cloud_id: local.cloud_id
      })
      if (upsertError) throw upsertError

      const { error: shareError } = await supabase.from('shares').upsert(
        {
          project_id: projectId,
          owner_id: session.user.id,
          shared_with_email: email,
          permission
        },
        { onConflict: 'project_id,shared_with_email' }
      )
      if (shareError) throw shareError
    }
  )

  ipcMain.handle('share:revokeShare', async (_event, projectId: string, email: string) => {
    const session = await requireSession()

    const { error } = await supabase
      .from('shares')
      .delete()
      .eq('project_id', projectId)
      .eq('owner_id', session.user.id)
      .eq('shared_with_email', email)
    if (error) throw error
  })

  ipcMain.handle('share:getSharedWithMe', async () => {
    const session = await requireSession()

    const { data, error } = await supabase
      .from('shares')
      .select('permission, cloud_projects(*)')
      .eq('shared_with_email', session.user.email)

    if (error) throw error

    return (data ?? []).map((row) => {
      const p = row.cloud_projects as unknown as CloudProjectRow
      return {
        id: p.id,
        name: p.name,
        path: '',
        daw_type: p.daw_type,
        size_bytes: p.size_bytes,
        last_modified: p.last_modified,
        synced_at: null,
        cloud_id: p.cloud_id,
        tags: JSON.parse(p.tags ?? '[]') as string[],
        created_at: p.created_at
      }
    })
  })

  ipcMain.handle('share:getProjectShares', async (_event, projectId: string) => {
    const session = await requireSession()

    const { data, error } = await supabase
      .from('shares')
      .select('*')
      .eq('project_id', projectId)
      .eq('owner_id', session.user.id)

    if (error) throw error

    return (data ?? []) as ShareRow[]
  })
}
