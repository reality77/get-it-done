<script setup lang="ts">
import { ref } from 'vue'
import type { ChecklistItem, ChecklistItemId, TaskPriority, TaskEffort } from '../../types'
import { getSnoozeOptions } from '../../stores/checklists'

const props = defineProps<{
  item: ChecklistItem
  itemId: ChecklistItemId
  close: () => void
}>()

const emit = defineEmits<{
  (e: 'activate', id: ChecklistItemId): void
  (e: 'snooze', id: ChecklistItemId, date: string): void
  (e: 'someday', id: ChecklistItemId): void
  (e: 'update-priority', id: ChecklistItemId, priority: TaskPriority): void
  (e: 'update-effort', id: ChecklistItemId, effort: TaskEffort): void
}>()

const snoozeOptions = getSnoozeOptions()
const pendingSnoozeDate = ref<string | null>(null)
const pendingSomeday = ref(false)
const pendingPriority = ref<TaskPriority | undefined>(props.item.priority)
const pendingEffort = ref<TaskEffort | undefined>(props.item.effort)

const itemStatus = () => props.item.status ?? 'active'

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent',    label: 'Urgent',    color: 'bg-red-500/20 text-red-400 border-red-500/40' },
  { value: 'important', label: 'Important', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  { value: 'secondary', label: 'Secondary', color: 'bg-zinc-700/60 text-zinc-400 border-zinc-600' },
]

const EFFORTS: { value: TaskEffort; label: string }[] = [
  { value: 'small',  label: 'S — Small' },
  { value: 'medium', label: 'M — Medium' },
  { value: 'large',  label: 'L — Large' },
]

function selectSnooze(date: string): void {
  pendingSnoozeDate.value = pendingSnoozeDate.value === date ? null : date
  pendingSomeday.value = false
}

function toggleSomeday(): void {
  pendingSomeday.value = !pendingSomeday.value
  pendingSnoozeDate.value = null
}

function confirm(): void {
  if (pendingSnoozeDate.value) {
    emit('snooze', props.itemId, pendingSnoozeDate.value)
  } else if (pendingSomeday.value) {
    emit('someday', props.itemId)
  }
  if (pendingPriority.value && pendingPriority.value !== props.item.priority) {
    emit('update-priority', props.itemId, pendingPriority.value)
  }
  if (pendingEffort.value && pendingEffort.value !== props.item.effort) {
    emit('update-effort', props.itemId, pendingEffort.value)
  }
  props.close()
}
</script>

<template>
  <!-- Activate (non-active items only) -->
  <div v-if="itemStatus() !== 'active'">
    <button
      class="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium rounded-xl border border-violet-600 bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 transition-colors"
      @click="emit('activate', itemId); close()"
    >
      ↩ Activate
    </button>
  </div>

  <!-- Snooze options (active items only) -->
  <div v-if="itemStatus() === 'active'">
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-2">💤 Snooze until…</p>
    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="opt in snoozeOptions"
        :key="opt.date"
        class="px-3 py-2.5 text-sm rounded-xl border transition-colors text-left"
        :class="pendingSnoozeDate === opt.date
          ? 'bg-amber-600/30 border-amber-500 text-amber-200'
          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'"
        @click="selectSnooze(opt.date)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>

  <!-- Someday (active items only) -->
  <div v-if="itemStatus() === 'active'">
    <button
      class="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium rounded-xl border transition-colors"
      :class="pendingSomeday
        ? 'bg-sky-600/30 border-sky-500 text-sky-200'
        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'"
      @click="toggleSomeday"
    >
      ☁ Move to Someday
    </button>
  </div>

  <!-- Priority -->
  <div>
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-2">Priority</p>
    <div class="flex gap-2">
      <button
        v-for="p in PRIORITIES"
        :key="p.value"
        class="flex-1 py-2.5 text-xs font-medium border rounded-xl transition-colors"
        :class="[p.color, pendingPriority === p.value ? 'ring-2 ring-violet-500' : '']"
        @click="pendingPriority = p.value"
      >
        {{ p.label }}
      </button>
    </div>
  </div>

  <!-- Effort -->
  <div>
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-2">Effort</p>
    <div class="flex gap-2">
      <button
        v-for="e in EFFORTS"
        :key="e.value"
        class="flex-1 py-2.5 text-xs font-medium border border-zinc-700 rounded-xl text-zinc-300 hover:bg-zinc-700 transition-colors"
        :class="pendingEffort === e.value ? 'bg-zinc-600 ring-2 ring-violet-500' : 'bg-zinc-800'"
        @click="pendingEffort = e.value"
      >
        {{ e.label }}
      </button>
    </div>
  </div>

  <!-- OK / Cancel -->
  <div class="flex gap-3 pt-1">
    <button
      class="flex-1 py-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 rounded-xl"
      @click="close()"
    >
      Cancel
    </button>
    <button
      class="flex-1 py-3 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors"
      @click="confirm"
    >
      OK
    </button>
  </div>
</template>
