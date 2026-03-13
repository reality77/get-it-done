<script setup lang="ts">
import { ref } from 'vue'
import type { ChecklistItem, ButtonActionDef } from '../../types'
import SnoozeMenu from './SnoozeMenu.vue'

defineProps<{
  item: ChecklistItem
  actions?: ButtonActionDef[]
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const openSnoozeLabel = ref<string | null>(null)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end sm:hidden"
    >
      <div class="absolute inset-0 bg-black/60" @click="emit('close')" />

      <div class="relative w-full bg-zinc-900 border-t border-zinc-700 rounded-t-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto">
        <p class="text-sm font-medium text-zinc-200 truncate border-b border-zinc-800 pb-3">{{ item.text }}</p>

        <!-- Default slot for custom content; fallback renders the actions list -->
        <slot :close="() => emit('close')">
          <div v-if="actions?.length" class="space-y-2">
            <template v-for="action in actions" :key="action.label">
              <!-- Snooze button with inline date picker -->
              <div v-if="action.snooze">
                <button
                  class="flex items-center justify-center w-full py-3 text-sm font-medium rounded-xl border transition-colors border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  @click="openSnoozeLabel = openSnoozeLabel === action.label ? null : action.label"
                >
                  {{ action.label }}<span v-if="action.title" class="ml-1 text-zinc-500 text-xs">&nbsp;{{ action.title }}</span>
                </button>
                <SnoozeMenu
                  v-if="openSnoozeLabel === action.label"
                  class="mt-1"
                  @pick="(date) => { action.snooze!(date); openSnoozeLabel = null; emit('close') }"
                  @cancel="openSnoozeLabel = null"
                />
              </div>
              <!-- Regular button -->
              <button
                v-else
                class="flex items-center justify-center w-full py-3 text-sm font-medium rounded-xl border transition-colors"
                :class="action.variant === 'danger'
                  ? 'border-red-800/60 bg-red-900/20 text-red-400 hover:bg-red-900/30'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'"
                @click="action.onClick?.(); emit('close')"
              >
                {{ action.label }}<span v-if="action.title" class="ml-1 text-zinc-500 text-xs">&nbsp;{{ action.title }}</span>
              </button>
            </template>
          </div>
          <!-- Cancel -->
          <button
            class="flex items-center justify-center w-full py-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 rounded-xl"
            @click="emit('close')"
          >
            Cancel
          </button>
        </slot>
      </div>
    </div>
  </Teleport>
</template>
