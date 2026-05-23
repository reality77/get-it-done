<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { TaskPriority } from '../../types'
import { useChecklistStore, STANDALONE_CHECKLIST_ID } from '../../stores/checklists'

const store = useChecklistStore()

const open = ref(false)
const text = ref('')
const priority = ref<TaskPriority>('important')
const inputEl = ref<HTMLInputElement | null>(null)

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent',    label: 'Urgent',    color: 'bg-danger/20 text-danger border-danger/40' },
  { value: 'important', label: 'Important', color: 'bg-warning/20 text-warning border-warning/40' },
  { value: 'secondary', label: 'Secondary', color: 'bg-bg-3/60 text-fg-3 border-border' },
]

async function openSheet(): Promise<void> {
  open.value = true
  await nextTick()
  inputEl.value?.focus()
}

function close(): void {
  open.value = false
  text.value = ''
  priority.value = 'important'
}

function submit(): void {
  const trimmed = text.value.trim()
  if (!trimmed) return
  const item = store.addItem(STANDALONE_CHECKLIST_ID, trimmed)
  if (priority.value !== 'important') {
    store.setItemPriority({ checklistId: STANDALONE_CHECKLIST_ID, itemId: item.id }, priority.value)
  }
  close()
}
</script>

<template>
  <!-- FAB button -->
  <button
    class="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-white shadow-xl flex items-center justify-center transition-transform active:scale-95"
    aria-label="New task"
    @click="openSheet"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  </button>

  <!-- Creation sheet -->
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div class="absolute inset-0 bg-black/60" @click="close" />

      <div class="relative w-full sm:max-w-md bg-bg-1 border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-4 space-y-4">
        <p class="text-sm font-semibold text-fg">New task</p>

        <input
          ref="inputEl"
          v-model="text"
          type="text"
          placeholder="What needs to be done?"
          class="w-full bg-bg-2 border border-border rounded-xl px-4 py-3 text-sm text-fg placeholder:text-fg-4 focus:border-primary focus:outline-none transition-colors"
          @keydown.enter.prevent="submit"
          @keydown.escape.prevent="close"
        />

        <div class="flex gap-2">
          <button
            v-for="p in PRIORITIES"
            :key="p.value"
            class="flex-1 py-2 text-xs font-medium border rounded-xl transition-colors"
            :class="[p.color, priority === p.value ? 'ring-2 ring-primary' : '']"
            @click="priority = p.value"
          >{{ p.label }}</button>
        </div>

        <div class="flex gap-3">
          <button
            class="flex-1 py-3 text-sm font-medium text-fg-3 hover:text-fg transition-colors border border-border rounded-xl"
            @click="close"
          >Cancel</button>
          <button
            class="flex-1 py-3 text-sm font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl transition-colors disabled:opacity-40"
            :disabled="!text.trim()"
            @click="submit"
          >Add task</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
