<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { TaskPriority, TaskEffort } from '../../types'
import { useChecklistStore, STANDALONE_CHECKLIST_ID } from '../../stores/checklists'
import { getSnoozeOptions } from '../../composables/useSnoozeOptions'
import VButton from '../atoms/VButton.vue'

const props = defineProps<{
  activeTab: 'today' | 'week' | 'backlog'
}>()

const store = useChecklistStore()

const open = ref(false)
const text = ref('')
const priority = ref<TaskPriority>('important')
const effort = ref<TaskEffort>('medium')

type SchedulingOption = 'today' | 'week' | 'next-week' | 'someday'
const scheduling = ref<SchedulingOption>('today')

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent',    label: 'Urgent',    color: 'bg-danger/20 text-danger border-danger/40' },
  { value: 'important', label: 'Important', color: 'bg-warning/20 text-warning border-warning/40' },
  { value: 'secondary', label: 'Secondary', color: 'bg-bg-3/60 text-fg-3 border-border' },
]

const EFFORTS: { value: TaskEffort; label: string }[] = [
  { value: 'small',  label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large',  label: 'Large' },
]

const SCHEDULING: { value: SchedulingOption; label: string }[] = [
  { value: 'today',     label: 'Today' },
  { value: 'week',      label: 'This week' },
  { value: 'next-week', label: 'Next week' },
  { value: 'someday',   label: 'Someday' },
]

function defaultScheduling(): SchedulingOption {
  if (props.activeTab === 'week') return 'week'
  if (props.activeTab === 'backlog') return 'next-week'
  return 'today'
}

async function openSheet(): Promise<void> {
  scheduling.value = defaultScheduling()
  open.value = true
  await nextTick()
  inputEl.value?.focus()
}

function close(): void {
  open.value = false
  text.value = ''
  priority.value = 'important'
  effort.value = 'medium'
  scheduling.value = defaultScheduling()
}

const inputEl = ref<HTMLInputElement | null>(null)

function submit(): void {
  const trimmed = text.value.trim()
  if (!trimmed) return
  const item = store.addItem(STANDALONE_CHECKLIST_ID, trimmed)
  const ref = { checklistId: STANDALONE_CHECKLIST_ID, itemId: item.id }

  if (priority.value !== 'important') {
    store.setItemPriority(ref, priority.value)
  }
  if (effort.value !== 'medium') {
    store.setItemEffort(ref, effort.value)
  }

  switch (scheduling.value) {
    case 'today':
      store.toggleItemDayPlan(ref)
      break
    case 'week':
      store.toggleItemWeekPlan(ref)
      break
    case 'next-week':
      store.snoozeItem(ref, getSnoozeOptions()[0]!.date)
      break
    case 'someday':
      store.sendItemToSomeday(ref)
      break
  }

  close()
}
</script>

<template>
  <!-- FAB button -->
  <button
    class="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 w-14 h-14 rounded-full bg-primary hover:brightness-110 text-fg-on-primary shadow-xl flex items-center justify-center transition-[transform,filter] active:scale-95"
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

        <!-- Priority -->
        <div class="flex gap-2">
          <button
            v-for="p in PRIORITIES"
            :key="p.value"
            class="flex-1 py-2 text-xs font-medium border rounded-xl transition-colors"
            :class="[p.color, priority === p.value ? 'ring-2 ring-primary' : '']"
            @click="priority = p.value"
          >{{ p.label }}</button>
        </div>

        <!-- Effort -->
        <div class="flex gap-2">
          <button
            v-for="e in EFFORTS"
            :key="e.value"
            class="flex-1 py-2 text-xs font-medium border rounded-xl transition-colors bg-bg-3/60 text-fg-3 border-border"
            :class="effort === e.value ? 'ring-2 ring-primary text-fg' : ''"
            @click="effort = e.value"
          >{{ e.label }}</button>
        </div>

        <!-- Scheduling -->
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="s in SCHEDULING"
            :key="s.value"
            class="px-3 py-1.5 text-xs font-medium border rounded-xl transition-colors bg-bg-3/60 text-fg-3 border-border"
            :class="scheduling === s.value ? 'ring-2 ring-primary text-fg' : ''"
            @click="scheduling = s.value"
          >{{ s.label }}</button>
        </div>

        <div class="flex gap-3">
          <VButton variant="secondary" class="flex-1" @click="close">Cancel</VButton>
          <VButton variant="primary" class="flex-1" :disabled="!text.trim()" @click="submit">Add task</VButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
