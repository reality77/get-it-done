import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { couchLogin, couchLogout, couchGetSession, ensureDatabase } from '../lib/couchdb'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const userEmail = computed(
    () => (import.meta.env.VITE_COUCH_USER as string | undefined) ?? 'admin'
  )

  async function checkSession(): Promise<void> {
    const name = await couchGetSession()
    isAuthenticated.value = name !== null
  }

  async function login(password: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await couchLogin(userEmail.value, password)
      await ensureDatabase()
      isAuthenticated.value = true
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'network') {
        error.value = 'Cannot reach the server. Check that CouchDB is running.'
      } else if (msg === 'server') {
        error.value = 'Server error. Please try again later.'
      } else {
        error.value = 'Invalid password. Please try again.'
      }
    } finally {
      isLoading.value = false
    }
  }

  function logout(): void {
    couchLogout()
    isAuthenticated.value = false
  }

  return { isAuthenticated, isLoading, error, userEmail, login, logout, checkSession }
})
