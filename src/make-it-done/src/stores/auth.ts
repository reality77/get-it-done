import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { pb } from '../lib/pocketbase'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(pb.authStore.isValid)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Bridge PocketBase's non-reactive auth state into Vue reactivity.
  // Fires when token is set, refreshed, or cleared (including expiry).
  pb.authStore.onChange(() => {
    isAuthenticated.value = pb.authStore.isValid
  })

  const userEmail = computed(
    () => (import.meta.env.VITE_PB_USER_EMAIL as string | undefined) ?? 'user@make-it-done.app'
  )

  async function login(password: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await pb.collection('users').authWithPassword(userEmail.value, password)
      isAuthenticated.value = true
    } catch {
      error.value = 'Invalid password. Please try again.'
    } finally {
      isLoading.value = false
    }
  }

  function logout(): void {
    pb.authStore.clear()
    isAuthenticated.value = false
  }

  return { isAuthenticated, isLoading, error, userEmail, login, logout }
})
