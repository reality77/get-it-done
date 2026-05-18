<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
  (e: 'delete', id: ChecklistItemId): void
  (e: 'update-text', id: ChecklistItemId, text: string): void
  (e: 'update-priority', id: ChecklistItemId, priority: TaskPriority): void
  (e: 'update-effort', id: ChecklistItemId, effort: TaskEffort): void
  (e: 'update-deadline', id: ChecklistItemId, deadline: string | null): void
  (e: 'update-reminders', id: ChecklistItemId, reminders: string[]): void
}>()

const snoozeOptions = getSnoozeOptions()
const pendingSnoozeDate = ref<string | null>(null)
const pendingSomeday = ref(false)
const pendingPriority = ref<TaskPriority | undefined>(props.item.priority)
const pendingEffort = ref<TaskEffort | undefined>(props.item.effort)

// ── Rename ────────────────────────────────────────────────────────────────────

const pendingText = ref(props.item.text)

watch(() => props.item.text, (t) => { pendingText.value = t }, { immediate: true })

// ── Deadline ──────────────────────────────────────────────────────────────────

function deadlineDatePart(d: string | null | undefined): string {
  if (!d) return ''
  return d.slice(0, 10)
}

function deadlineTimePart(d: string | null | undefined): string {
  if (!d || d.length <= 10) return ''
  return d.slice(11, 16)
}

const pendingDeadlineDate = ref(deadlineDatePart(props.item.deadline))
const pendingDeadlineTime = ref(deadlineTimePart(props.item.deadline))
const deadlineHasTime = ref(Boolean(props.item.deadline && props.item.deadline.length > 10))

// Keep deadline state in sync with prop — handles component reuse between opens
watch(() => props.item.deadline, (d) => {
  pendingDeadlineDate.value = deadlineDatePart(d)
  pendingDeadlineTime.value = deadlineTimePart(d)
  deadlineHasTime.value = Boolean(d && d.length > 10)
}, { immediate: true })

function buildDeadline(): string | null {
  if (!pendingDeadlineDate.value) return null
  if (deadlineHasTime.value && pendingDeadlineTime.value) {
    return `${pendingDeadlineDate.value}T${pendingDeadlineTime.value}`
  }
  return pendingDeadlineDate.value
}

function clearDeadline(): void {
  pendingDeadlineDate.value = ''
  pendingDeadlineTime.value = ''
  deadlineHasTime.value = false
}

// ── Reminders ─────────────────────────────────────────────────────────────────

const pendingReminders = ref<string[]>([...(props.item.reminders ?? [])])

// Keep reminders in sync with prop — handles component reuse between opens
watch(() => props.item.reminders, (r) => {
  pendingReminders.value = [...(r ?? [])]
}, { immediate: true })

interface ReminderPreset { key: string; label: string; compute: () => string }

const absolutePresets: ReminderPreset[] = [
  {
    key: '2h',
    label: 'In 2 hours',
    compute: () => new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
  },
  {
    key: 'tomorrow',
    label: 'Tomorrow, 9am',
    compute: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
      return d.toISOString()
    },
  },
  {
    key: '3d',
    label: 'In 3 days',
    compute: () => {
      const d = new Date()
      d.setDate(d.getDate() + 3)
      d.setHours(9, 0, 0, 0)
      return d.toISOString()
    },
  },
  {
    key: '1w',
    label: 'In 1 week',
    compute: () => {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      d.setHours(9, 0, 0, 0)
      return d.toISOString()
    },
  },
]

const deadlinePresets = computed<ReminderPreset[]>(() => {
  if (!pendingDeadlineDate.value) return []
  const dl = new Date(`${pendingDeadlineDate.value}T09:00:00`).getTime()
  return [
    { key: 'dl-1d',  label: '1 day before',   compute: () => new Date(dl - 1 * 86400000).toISOString() },
    { key: 'dl-3d',  label: '3 days before',  compute: () => new Date(dl - 3 * 86400000).toISOString() },
    { key: 'dl-1w',  label: '1 week before',  compute: () => new Date(dl - 7 * 86400000).toISOString() },
    { key: 'dl-2w',  label: '2 weeks before', compute: () => new Date(dl - 14 * 86400000).toISOString() },
  ]
})

function nearMatch(iso: string): string | null {
  const t = new Date(iso).getTime()
  return pendingReminders.value.find(r => Math.abs(new Date(r).getTime() - t) < 5 * 60 * 1000) ?? null
}

function toggleReminder(preset: ReminderPreset): void {
  const iso = preset.compute()
  const match = nearMatch(iso)
  if (match) {
    pendingReminders.value = pendingReminders.value.filter(r => r !== match)
  } else {
    pendingReminders.value = [...pendingReminders.value, iso]
  }
}

function isPresetSelected(preset: ReminderPreset): boolean {
  return nearMatch(preset.compute()) !== null
}

function removeReminder(iso: string): void {
  pendingReminders.value = pendingReminders.value.filter(r => r !== iso)
}

function formatReminder(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function isReminderPast(iso: string): boolean {
  return new Date(iso) < new Date()
}

// ── Status helpers ────────────────────────────────────────────────────────────

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

// ── Confirm / Delete ──────────────────────────────────────────────────────────

function confirm(): void {
  if (pendingSnoozeDate.value) {
    emit('snooze', props.itemId, pendingSnoozeDate.value)
  } else if (pendingSomeday.value) {
    emit('someday', props.itemId)
  }
  if (pendingPriority.value !== undefined && pendingPriority.value !== props.item.priority) {
    emit('update-priority', props.itemId, pendingPriority.value)
  }
  if (pendingEffort.value !== undefined && pendingEffort.value !== props.item.effort) {
    emit('update-effort', props.itemId, pendingEffort.value)
  }
  const trimmed = pendingText.value.trim()
  if (trimmed && trimmed !== props.item.text) {
    emit('update-text', props.itemId, trimmed)
  }
  const newDeadline = buildDeadline()
  if (newDeadline !== (props.item.deadline ?? null)) {
    emit('update-deadline', props.itemId, newDeadline)
  }
  const currentReminders = props.item.reminders ?? []
  const changed =
    pendingReminders.value.length !== currentReminders.length ||
    pendingReminders.value.some(r => !currentReminders.includes(r))
  if (changed) {
    emit('update-reminders', props.itemId, [...pendingReminders.value])
  }
  props.close()
}

function deleteItem(): void {
  emit('delete', props.itemId)
  props.close()
}
</script>

<template>
  <!-- Rename -->
  <div>
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-2">Rename</p>
    <input
      v-model="pendingText"
      class="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none transition-colors"
      @keydown.enter.prevent="confirm"
    />
  </div>

  <!-- Deadline -->
  <div>
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-2">📅 Deadline</p>
    <div class="flex gap-2 items-center">
      <input
        type="date"
        v-model="pendingDeadlineDate"
        class="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:border-violet-500 focus:outline-none transition-colors"
      />
      <button
        v-if="pendingDeadlineDate"
        class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        title="Clear deadline"
        @click="clearDeadline"
      >
        ✕
      </button>
    </div>
    <div v-if="pendingDeadlineDate" class="mt-2 flex items-center gap-3">
      <label class="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
        <input type="checkbox" v-model="deadlineHasTime" class="accent-violet-500 rounded" />
        Add time
      </label>
      <input
        v-if="deadlineHasTime"
        type="time"
        v-model="pendingDeadlineTime"
        class="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:border-violet-500 focus:outline-none transition-colors"
      />
    </div>
  </div>

  <!-- Reminders -->
  <div>
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-2">🔔 Remind me</p>

    <!-- Currently scheduled reminders -->
    <div v-if="pendingReminders.length > 0" class="flex flex-wrap gap-1.5 mb-3">
      <span
        v-for="r in pendingReminders"
        :key="r"
        class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border"
        :class="isReminderPast(r)
          ? 'bg-zinc-900 border-zinc-700 text-zinc-500'
          : 'bg-violet-900/30 border-violet-700 text-violet-300'"
      >
        {{ formatReminder(r) }}
        <button
          class="ml-0.5 hover:text-white transition-colors"
          @click="removeReminder(r)"
        >✕</button>
      </span>
    </div>

    <!-- Absolute presets -->
    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="preset in absolutePresets"
        :key="preset.key"
        class="px-3 py-2.5 text-sm rounded-xl border transition-colors text-left"
        :class="isPresetSelected(preset)
          ? 'bg-violet-600/30 border-violet-500 text-violet-200'
          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'"
        @click="toggleReminder(preset)"
      >
        {{ preset.label }}
      </button>
    </div>

    <!-- Deadline-relative presets -->
    <div v-if="deadlinePresets.length > 0" class="grid grid-cols-2 gap-2 mt-2">
      <button
        v-for="preset in deadlinePresets"
        :key="preset.key"
        class="px-3 py-2.5 text-sm rounded-xl border transition-colors text-left"
        :class="isPresetSelected(preset)
          ? 'bg-violet-600/30 border-violet-500 text-violet-200'
          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'"
        @click="toggleReminder(preset)"
      >
        {{ preset.label }}
      </button>
    </div>
  </div>

  <!-- Activate (non-active items only) -->
  <div v-if="itemStatus() !== 'active'">
    <button
      class="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium rounded-xl border border-violet-600 bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 transition-colors"
      @click="emit('activate', itemId); close()"
    >
      ↩ Activate
    </button>
  </div>

  <!-- Snooze (active items only) -->
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
  <div v-if="pendingPriority !== undefined">
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
  <div v-if="pendingEffort !== undefined">
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

  <!-- Delete -->
  <button
    class="flex items-center justify-center w-full py-3 text-sm font-medium rounded-xl border border-red-800/60 bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors"
    @click="deleteItem"
  >
    ✕ Delete task
  </button>

  <!-- Cancel / OK -->
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
