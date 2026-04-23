<script setup lang="ts">
import AppButton from '../atoms/AppButton.vue'
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
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm">

      <!-- Header -->
      <div class="flex items-center justify-between mb-5">
        <div>
          <h2 class="text-base font-semibold text-zinc-100">Notifications</h2>
          <p class="text-xs text-zinc-500 mt-0.5">Push alerts for this device</p>
        </div>
        <AppButton variant="ghost" class="text-lg leading-none" @click="emit('close')">✕</AppButton>
      </div>

      <!-- Not supported -->
      <div v-if="!supported" class="text-sm text-zinc-500">
        Push notifications are not supported in this browser. Install the app to your home
        screen on Android or iOS 16.4+ to enable them.
      </div>

      <template v-else>
        <!-- Permission denied by browser -->
        <div v-if="denied" class="text-sm text-zinc-400 bg-zinc-800 rounded-lg px-4 py-3">
          <p class="font-medium text-zinc-200 mb-1">Notifications blocked</p>
          <p class="text-zinc-500">
            Open your browser or OS settings and allow notifications for this site, then
            return here to enable them.
          </p>
        </div>

        <template v-else>
          <!-- Enable / disable toggle row -->
          <div class="flex items-center justify-between mb-5">
            <div>
              <p class="text-sm text-zinc-200 font-medium">Enable notifications</p>
              <p class="text-xs text-zinc-500 mt-0.5">
                {{ isSubscribed ? 'This device will receive alerts' : 'No alerts on this device' }}
              </p>
            </div>
            <button
              :disabled="loading"
              class="relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50"
              :class="isSubscribed ? 'bg-violet-600' : 'bg-zinc-700'"
              @click="handleToggle"
            >
              <span
                class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                :class="isSubscribed ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Daily reminder time (only when subscribed) -->
          <div v-if="isSubscribed" class="border-t border-zinc-800 pt-4">
            <label class="block text-sm text-zinc-200 font-medium mb-1">
              Daily planning reminder
            </label>
            <p class="text-xs text-zinc-500 mb-3">
              Receive a daily nudge to plan your day. Leave empty to disable.
            </p>
            <input
              :value="dailyReminderTime"
              type="time"
              class="bg-zinc-800 border border-zinc-700 focus:border-violet-500 outline-none text-zinc-100 rounded-lg px-3 py-1.5 text-sm w-full transition-colors"
              @change="updateReminderTime(($event.target as HTMLInputElement).value)"
            />
          </div>
        </template>

        <!-- Error message -->
        <p v-if="error" class="text-sm text-red-400 mt-4">{{ error }}</p>

        <!-- Permission status hint -->
        <p v-if="permission === 'default' && !isSubscribed" class="text-xs text-zinc-600 mt-4">
          Your browser will ask for permission when you enable notifications.
        </p>
      </template>

    </div>
  </div>
</template>
