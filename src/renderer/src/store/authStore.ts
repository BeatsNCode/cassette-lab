import { create } from 'zustand'
import type { User } from '../../../preload/index.d'

interface AuthState {
  user: User | null
  loading: boolean
  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    try {
      const user = await window.api.auth.getSession()
      set({ user })
    } finally {
      set({ loading: false })
    }
  },

  login: async (email, password) => {
    const user = await window.api.auth.login(email, password)
    set({ user })
  },

  signUp: async (email, password) => {
    await window.api.auth.signUp(email, password)
  },

  logout: async () => {
    await window.api.auth.logout()
    set({ user: null })
  }
}))
