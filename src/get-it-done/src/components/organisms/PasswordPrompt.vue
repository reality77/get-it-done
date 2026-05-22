<script setup lang="ts">
import { ref } from 'vue'
import VButton from '../atoms/VButton.vue'
import VField from '../atoms/VField.vue'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const password = ref('')

async function submit(): Promise<void> {
  if (!password.value.trim() || authStore.isLoading) return
  await authStore.login(password.value)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') submit()
}

const emit = defineEmits<{
  (e: 'cancel'): void
}>()

</script>

<template>
  <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
    <!-- No @click.self dismiss — auth is required to use the app -->
    <div class="bg-bg-1 border border-hairline rounded-2xl p-6 w-full max-w-sm">
      <h2 class="text-base font-semibold text-fg mb-1">Sign in</h2>
      <p class="text-sm text-fg-4 mb-5">
        Enter your password to sync across devices.
      </p>

      <div class="mb-4">
        <p class="text-xs text-fg-4 mb-1">Account</p>
        <p class="text-sm text-fg-3">{{ authStore.userEmail }}</p>
      </div>

      <div class="mb-5">
        <VField
          v-model="password"
          type="password"
          placeholder="Password"
          :autofocus="true"
          @keydown="onKeydown"
        />
      </div>

      <p v-if="authStore.error" class="text-sm text-danger mb-4">
        {{ authStore.error }}
      </p>

      <div class="flex justify-end gap-4">
        <VButton variant="secondary" @click="emit('cancel')">Cancel</VButton>
        <VButton
          variant="primary"
          :disabled="!password.trim() || authStore.isLoading"
          @click="submit"
        >
          {{ authStore.isLoading ? 'Signing in…' : 'Sign in' }}
        </VButton>
      </div>
    </div>
  </div>
</template>
