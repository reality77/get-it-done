<script setup lang="ts">
import { ref } from 'vue'
import type { ButtonActionDef } from '../../types'
import AppButton from '../atoms/AppButton.vue'
import SnoozeMenu from './SnoozeMenu.vue'

defineProps<{
  actions: ButtonActionDef[]
  hasMobileSheet: boolean
}>()

const emit = defineEmits<{
  (e: 'open-mobile-menu'): void
}>()

const openSnoozeLabel = ref<string | null>(null)
</script>

<template>
  <div class="flex items-center gap-1 shrink-0 relative">
    <!-- Mobile ⋯ trigger (only when a mobile sheet is available) -->
    <AppButton
      v-if="hasMobileSheet"
      class="sm:hidden"
      variant="icon"
      title="Actions"
      @click="emit('open-mobile-menu')"
    >
      ⋯
    </AppButton>

    <!-- Desktop action buttons (hover-reveal); always visible on mobile when no sheet -->
    <div
      v-if="actions.length"
      class="items-center gap-1 transition-opacity relative"
      :class="hasMobileSheet
        ? 'hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100'
        : 'flex sm:opacity-0 sm:group-hover:opacity-100'"
    >
      <template v-for="action in actions" :key="action.label">
        <!-- Snooze button with dropdown -->
        <div v-if="action.snooze" class="relative">
          <AppButton
            variant="icon"
            :title="action.title"
            @click="openSnoozeLabel = openSnoozeLabel === action.label ? null : action.label"
          >{{ action.label }}</AppButton>
          <SnoozeMenu
            v-if="openSnoozeLabel === action.label"
            class="absolute right-0 top-full mt-1 z-10"
            @pick="(date) => { action.snooze!(date); openSnoozeLabel = null }"
            @cancel="openSnoozeLabel = null"
          />
        </div>
        <!-- Regular button -->
        <AppButton
          v-else
          :variant="action.variant ?? 'icon'"
          :title="action.title"
          @click="action.onClick?.()"
        >{{ action.label }}</AppButton>
      </template>
    </div>
  </div>
</template>
