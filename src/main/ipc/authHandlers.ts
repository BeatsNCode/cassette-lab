import { ipcMain } from 'electron'
import { supabase } from '../lib/supabase'

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_event, email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return { id: data.user.id, email: data.user.email! }
  })

  ipcMain.handle('auth:logout', async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  })

  ipcMain.handle('auth:signUp', async (_event, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (!data.user) throw new Error('Sign up succeeded but no user was returned')
    return { id: data.user.id, email: data.user.email! }
  })

  ipcMain.handle('auth:getSession', async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    const user = data.session?.user
    if (!user) return null
    return { id: user.id, email: user.email! }
  })
}