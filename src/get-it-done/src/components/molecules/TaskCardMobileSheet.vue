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

      <div class="relative w-full bg-bg-1 border-t border-border rounded-t-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto">

        <!-- Default slot; fallback renders title + actions list -->
        <slot :close="() => emit('close')">
          <p class="text-sm font-medium text-fg truncate border-b border-hairline pb-3">{{ item.text }}</p>
          <div v-if="actions?.length" class="space-y-2">
            <template v-for="action in actions" :key="action.label">
              <!-- Snooze button with inline date picker -->
              <div v-if="action.snooze">
                <button
                  class="flex items-center justify-center w-full py-3 text-sm font-medium rounded-xl border transition-colors border-border bg-bg-2 text-fg-2 hover:bg-bg-3"
                  @click="openSnoozeLabel = openSnoozeLabel === action.label ? null : action.label"
                >
                  {{ action.label }}<span v-if="action.title" class="ml-1 text-fg-4 text-xs">&nbsp;{{ action.title }}</span>
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
                  ? 'border-danger/40 bg-danger/15 text-danger hover:bg-danger/20'
                  : 'border-border bg-bg-2 text-fg-2 hover:bg-bg-3'"
                @click="action.onClick?.(); emit('close')"
              >
                {{ action.label }}<span v-if="action.title" class="ml-1 text-fg-4 text-xs">&nbsp;{{ action.title }}</span>
              </button>
            </template>
          </div>
          <!-- Cancel -->
          <button
            class="flex items-center justify-center w-full py-3 text-sm font-medium text-fg-3 hover:text-fg transition-colors border border-border rounded-xl"
            @click="emit('close')"
          >
            Cancel
          </button>
        </slot>
      </div>
    </div>
  </Teleport>
</template>
