<script setup lang="ts">
import VButton from '../atoms/VButton.vue'
import { useNotifications } from '../../composables/useNotifications'

const emit = defineEmits<{ (e: 'close'): void }>()

const {
  supported,
  permission,
  isSubscribed,
  dailyReminderTime,
  loading,
  error,
  denied,
  subscribe,
  unsubscribe,
  updateReminderTime,
} = useNotifications()

function handleToggle(): void {
  if (isSubscribed.value) unsubscribe()
  else subscribe()
}
</script>

<template>
  <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
    <div class="bg-bg-1 border border-hairline rounded-2xl p-6 w-full max-w-sm">

      <!-- Header -->
      <div class="flex items-center justify-between mb-5">
        <div>
          <h2 class="text-base font-semibold text-fg">Notifications</h2>
          <p class="text-xs text-fg-4 mt-0.5">Push alerts for this device</p>
        </div>
        <VButton variant="ghost" class="text-lg leading-none" @click="emit('close')">✕</VButton>
      </div>

      <!-- Not supported -->
      <div v-if="!supported" class="text-sm text-fg-4">
        Push notifications are not supported in this browser. Install the app to your home
        screen on Android or iOS 16.4+ to enable them.
      </div>

      <template v-else>
        <!-- Permission denied by browser -->
        <div v-if="denied" class="text-sm text-fg-3 bg-bg-2 rounded-lg px-4 py-3">
          <p class="font-medium text-fg mb-1">Notifications blocked</p>
          <p class="text-fg-4">
            Open your browser or OS settings and allow notifications for this site, then
            return here to enable them.
          </p>
        </div>

        <template v-else>
          <!-- Enable / disable toggle row -->
          <div class="flex items-center justify-between mb-5">
            <div>
              <p class="text-sm text-fg font-medium">Enable notifications</p>
              <p class="text-xs text-fg-4 mt-0.5">
                {{ isSubscribed ? 'This device will receive alerts' : 'No alerts on this device' }}
              </p>
            </div>
            <button
              :disabled="loading"
              class="relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50"
              :class="isSubscribed ? 'bg-primary' : 'bg-bg-3'"
              @click="handleToggle"
            >
              <span
                class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                :class="isSubscribed ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Daily reminder time (only when subscribed) -->
          <div v-if="isSubscribed" class="border-t border-hairline pt-4">
            <label class="block text-sm text-fg font-medium mb-1">
              Daily planning reminder
            </label>
            <p class="text-xs text-fg-4 mb-3">
              Receive a daily nudge to plan your day. Leave empty to disable.
            </p>
            <input
              :value="dailyReminderTime"
              type="time"
              class="bg-bg-2 border border-border focus:border-primary outline-none text-fg rounded-lg px-3 py-1.5 text-sm w-full transition-colors"
              @change="updateReminderTime(($event.target as HTMLInputElement).value)"
            />
          </div>
        </template>

        <!-- Error message -->
        <p v-if="error" class="text-sm text-danger mt-4">{{ error }}</p>

        <!-- Permission status hint -->
        <p v-if="permission === 'default' && !isSubscribed" class="text-xs text-fg-4 mt-4">
          Your browser will ask for permission when you enable notifications.
        </p>
      </template>

    </div>
  </div>
</template>
