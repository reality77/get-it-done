<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ChecklistItem, ChecklistItemId, TaskPriority, TaskEffort } from '../../types'
import { getSnoozeOptions, useChecklistStore } from '../../stores/checklists'

const props = defineProps<{
  item: ChecklistItem
  itemId: ChecklistItemId
  close: () => void
}>()

const store = useChecklistStore()

// ── Accordion ─────────────────────────────────────────────────────────────────

type SectionName = 'deadline' | 'reminders' | 'snooze' | 'priority' | 'effort' | 'comment' | 'url'
const activeSection = ref<SectionName | null>(null)

function toggleSection(name: SectionName): void {
  activeSection.value = activeSection.value === name ? null : name
}

// ── Title editing ─────────────────────────────────────────────────────────────

const pendingText = ref(props.item.text)
const isEditingTitle = ref(false)
const titleSnapshot = ref(props.item.text)

function startTitleEdit(): void {
  titleSnapshot.value = pendingText.value
  isEditingTitle.value = true
}

function stopTitleEdit(): void {
  isEditingTitle.value = false
}

function cancelTitleEdit(): void {
  pendingText.value = titleSnapshot.value
  isEditingTitle.value = false
}

// ── Snooze / Someday ──────────────────────────────────────────────────────────

const snoozeOptions = getSnoozeOptions()
const pendingSnoozeDate = ref<string | null>(null)
const pendingSomeday = ref(false)

function selectSnooze(date: string): void {
  pendingSnoozeDate.value = pendingSnoozeDate.value === date ? null : date
  pendingSomeday.value = false
}

function toggleSomeday(): void {
  pendingSomeday.value = !pendingSomeday.value
  pendingSnoozeDate.value = null
}

// ── Priority / Effort ─────────────────────────────────────────────────────────

const pendingPriority = ref<TaskPriority | undefined>(props.item.priority)
const pendingEffort = ref<TaskEffort | undefined>(props.item.effort)
const pendingComment = ref(props.item.comment ?? '')
const pendingUrl = ref(props.item.url ?? '')

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent',    label: 'Urgent',    color: 'bg-danger/20 text-danger border-danger/40' },
  { value: 'important', label: 'Important', color: 'bg-warning/20 text-warning border-warning/40' },
  { value: 'secondary', label: 'Secondary', color: 'bg-bg-3/60 text-fg-3 border-border' },
]

const EFFORTS: { value: TaskEffort; label: string }[] = [
  { value: 'small',  label: 'S — Small' },
  { value: 'medium', label: 'M — Medium' },
  { value: 'large',  label: 'L — Large' },
]

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

// ── Display summaries ─────────────────────────────────────────────────────────

const itemStatus = () => props.item.status ?? 'active'

const deadlineSummary = computed(() => {
  if (!pendingDeadlineDate.value) return '—'
  const date = new Date(`${pendingDeadlineDate.value}T12:00:00`)
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (deadlineHasTime.value && pendingDeadlineTime.value) return `${dateStr}, ${pendingDeadlineTime.value}`
  return dateStr
})

const remindersSummary = computed(() => {
  const n = pendingReminders.value.length
  if (n === 0) return '—'
  if (n === 1) return formatReminder(pendingReminders.value[0]!)
  return `${n} reminders`
})

const snoozeSummary = computed(() => {
  if (pendingSnoozeDate.value) {
    return snoozeOptions.find(o => o.date === pendingSnoozeDate.value)?.label ?? pendingSnoozeDate.value
  }
  if (pendingSomeday.value) return 'Someday'
  const status = props.item.status ?? 'active'
  if (status === 'snoozed') {
    if (props.item.snoozeUntil) {
      const d = new Date(props.item.snoozeUntil + 'T12:00:00')
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }
    return 'Snoozed'
  }
  if (status === 'someday') return 'Someday'
  return '—'
})

const snoozeStatusColor = computed(() => {
  if (pendingSnoozeDate.value) return 'text-warning'
  if (pendingSomeday.value) return 'text-info'
  const status = props.item.status ?? 'active'
  if (status === 'snoozed') return 'text-warning'
  if (status === 'someday') return 'text-info'
  return 'text-fg-4'
})

const prioritySummary = computed(() => PRIORITIES.find(p => p.value === pendingPriority.value)?.label ?? '—')

const effortSummary = computed(() => {
  const e = EFFORTS.find(e => e.value === pendingEffort.value)
  return e ? e.label.split(' — ')[0] : '—'
})

const priorityColor = computed(() => {
  if (pendingPriority.value === 'urgent')    return 'bg-danger/20 text-danger border-danger/40'
  if (pendingPriority.value === 'important') return 'bg-warning/20 text-warning border-warning/40'
  if (pendingPriority.value === 'secondary') return 'bg-bg-3/60 text-fg-3 border-border'
  return 'text-fg-4 border-transparent'
})

const commentSummary = computed(() =>
  pendingComment.value.trim()
    ? pendingComment.value.trim().slice(0, 30) + (pendingComment.value.trim().length > 30 ? '…' : '')
    : '—'
)

function urlHostname(raw: string): string {
  try { return new URL(raw).hostname } catch { return raw }
}

const urlSummary = computed(() =>
  pendingUrl.value.trim() ? urlHostname(pendingUrl.value.trim()) : '—'
)

// ── Confirm / Delete ──────────────────────────────────────────────────────────

function confirm(): void {
  if (pendingSnoozeDate.value) {
    store.snoozeItem(props.itemId, pendingSnoozeDate.value)
  } else if (pendingSomeday.value) {
    store.sendItemToSomeday(props.itemId)
  }
  if (pendingPriority.value !== undefined && pendingPriority.value !== props.item.priority) {
    store.setItemPriority(props.itemId, pendingPriority.value)
  }
  if (pendingEffort.value !== undefined && pendingEffort.value !== props.item.effort) {
    store.setItemEffort(props.itemId, pendingEffort.value)
  }
  const trimmed = pendingText.value.trim()
  if (trimmed && trimmed !== props.item.text) {
    store.updateItemText(props.itemId, trimmed)
  }
  const newDeadline = buildDeadline()
  if (newDeadline !== (props.item.deadline ?? null)) {
    store.setItemDeadline(props.itemId, newDeadline)
  }
  const currentReminders = props.item.reminders ?? []
  const changed =
    pendingReminders.value.length !== currentReminders.length ||
    pendingReminders.value.some(r => !currentReminders.includes(r))
  if (changed) {
    store.setItemReminders(props.itemId, [...pendingReminders.value])
  }
  const trimmedComment = pendingComment.value.trim()
  if (trimmedComment !== (props.item.comment ?? '')) {
    store.updateItemComment(props.itemId, trimmedComment)
  }
  const trimmedUrl = pendingUrl.value.trim()
  if (trimmedUrl !== (props.item.url ?? '')) {
    store.updateItemUrl(props.itemId, trimmedUrl)
  }
  props.close()
}

function deleteItem(): void {
  store.removeItem(props.itemId)
  props.close()
}
</script>

<template>
  <!-- Editable title -->
  <div class="border-b border-hairline pb-3 mb-1">
    <input
      v-if="isEditingTitle"
      v-focus
      v-model="pendingText"
      class="w-full bg-transparent text-sm font-medium text-fg outline-none border-b border-primary pb-0.5 transition-colors"
      @keydown.enter.prevent="stopTitleEdit"
      @keydown.escape.prevent="cancelTitleEdit"
      @blur="stopTitleEdit"
    />
    <button
      v-else
      class="w-full text-left flex items-center justify-between gap-2 group"
      @click="startTitleEdit"
    >
      <span class="text-sm font-medium text-fg truncate">{{ pendingText }}</span>
      <span class="shrink-0 text-fg-4 group-hover:text-fg-3 text-xs transition-colors">✏</span>
    </button>
  </div>

  <!-- Option sections (accordion) -->
  <div class="space-y-0.5">

    <!-- Deadline -->
    <div>
      <button
        class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg-2/80 transition-colors"
        :class="activeSection === 'deadline' ? 'bg-bg-2/80' : ''"
        @click="toggleSection('deadline')"
      >
        <span class="text-sm text-fg-2">📅 Deadline</span>
        <span class="text-sm" :class="pendingDeadlineDate ? 'text-primary' : 'text-fg-4'">{{ deadlineSummary }}</span>
      </button>
      <div v-if="activeSection === 'deadline'" class="px-3 pb-3 pt-1 space-y-2">
        <div class="flex gap-2 items-center">
          <input
            type="date"
            v-model="pendingDeadlineDate"
            class="flex-1 bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-fg-2 focus:border-primary focus:outline-none transition-colors"
          />
          <button
            v-if="pendingDeadlineDate"
            class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-fg-4 hover:text-fg-2 hover:bg-bg-2 transition-colors"
            @click="clearDeadline"
          >✕</button>
        </div>
        <div v-if="pendingDeadlineDate" class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 text-xs text-fg-3 cursor-pointer select-none">
            <input type="checkbox" v-model="deadlineHasTime" class="accent-primary rounded" />
            Add time
          </label>
          <input
            v-if="deadlineHasTime"
            type="time"
            v-model="pendingDeadlineTime"
            class="bg-bg-2 border border-border rounded-xl px-3 py-2 text-sm text-fg-2 focus:border-primary focus:outline-none transition-colors"
          />
        </div>
      </div>
    </div>

    <!-- Reminders -->
    <div>
      <button
        class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg-2/80 transition-colors"
        :class="activeSection === 'reminders' ? 'bg-bg-2/80' : ''"
        @click="toggleSection('reminders')"
      >
        <span class="text-sm text-fg-2">🔔 Reminders</span>
        <span class="text-sm" :class="pendingReminders.length > 0 ? 'text-primary' : 'text-fg-4'">{{ remindersSummary }}</span>
      </button>
      <div v-if="activeSection === 'reminders'" class="px-3 pb-3 pt-1 space-y-2">
        <div v-if="pendingReminders.length > 0" class="flex flex-wrap gap-1.5">
          <span
            v-for="r in pendingReminders"
            :key="r"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border"
            :class="isReminderPast(r)
              ? 'bg-bg-1 border-border text-fg-4'
              : 'bg-primary/15 border-primary/50 text-primary'"
          >
            {{ formatReminder(r) }}
            <button class="ml-0.5 hover:text-white transition-colors" @click="removeReminder(r)">✕</button>
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="preset in absolutePresets"
            :key="preset.key"
            class="px-3 py-2 text-sm rounded-xl border transition-colors text-left"
            :class="isPresetSelected(preset)
              ? 'bg-primary/30 border-primary text-primary'
              : 'bg-bg-2 border-border text-fg-2 hover:bg-bg-3'"
            @click="toggleReminder(preset)"
          >{{ preset.label }}</button>
        </div>
        <div v-if="deadlinePresets.length > 0" class="grid grid-cols-2 gap-2">
          <button
            v-for="preset in deadlinePresets"
            :key="preset.key"
            class="px-3 py-2 text-sm rounded-xl border transition-colors text-left"
            :class="isPresetSelected(preset)
              ? 'bg-primary/30 border-primary text-primary'
              : 'bg-bg-2 border-border text-fg-2 hover:bg-bg-3'"
            @click="toggleReminder(preset)"
          >{{ preset.label }}</button>
        </div>
      </div>
    </div>

    <!-- Comment -->
    <div>
      <button
        class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg-2/80 transition-colors"
        :class="activeSection === 'comment' ? 'bg-bg-2/80' : ''"
        @click="toggleSection('comment')"
      >
        <span class="text-sm text-fg-2">💬 Comment</span>
        <span class="text-sm truncate max-w-[140px] text-right" :class="pendingComment.trim() ? 'text-primary' : 'text-fg-4'">{{ commentSummary }}</span>
      </button>
      <div v-if="activeSection === 'comment'" class="px-3 pb-3 pt-1">
        <textarea
          v-model="pendingComment"
          rows="3"
          placeholder="Add a note…"
          class="w-full bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-fg-2 placeholder-fg-4 focus:border-primary focus:outline-none transition-colors resize-none"
        />
      </div>
    </div>

    <!-- URL -->
    <div>
      <button
        class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg-2/80 transition-colors"
        :class="activeSection === 'url' ? 'bg-bg-2/80' : ''"
        @click="toggleSection('url')"
      >
        <span class="text-sm text-fg-2">🔗 URL</span>
        <span class="text-sm truncate max-w-[140px] text-right" :class="pendingUrl.trim() ? 'text-primary' : 'text-fg-4'">{{ urlSummary }}</span>
      </button>
      <div v-if="activeSection === 'url'" class="px-3 pb-3 pt-1">
        <input
          type="url"
          v-model="pendingUrl"
          placeholder="https://…"
          class="w-full bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-fg-2 placeholder-fg-4 focus:border-primary focus:outline-none transition-colors"
        />
      </div>
    </div>

    <!-- Snooze / Status -->
    <div>
      <button
        class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg-2/80 transition-colors"
        :class="activeSection === 'snooze' ? 'bg-bg-2/80' : ''"
        @click="toggleSection('snooze')"
      >
        <span class="text-sm text-fg-2">💤 Snooze</span>
        <span class="text-sm" :class="snoozeStatusColor">{{ snoozeSummary }}</span>
      </button>
      <div v-if="activeSection === 'snooze'" class="px-3 pb-3 pt-1 space-y-2">
        <button
          v-if="itemStatus() !== 'active'"
          class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-primary bg-primary/20 text-primary hover:bg-primary/30 transition-colors text-sm font-medium"
          @click="store.activateItem(itemId); close()"
        >↩ Activate</button>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="opt in snoozeOptions"
            :key="opt.date"
            class="px-3 py-2.5 text-sm rounded-xl border transition-colors text-left"
            :class="pendingSnoozeDate === opt.date
              ? 'bg-warning/25 border-warning text-warning'
              : 'bg-bg-2 border-border text-fg-2 hover:bg-bg-3'"
            @click="selectSnooze(opt.date)"
          >{{ opt.label }}</button>
        </div>
        <button
          class="w-full px-3 py-2.5 text-sm rounded-xl border transition-colors text-left"
          :class="pendingSomeday
            ? 'bg-sky-600/30 border-sky-500 text-sky-200'
            : 'bg-bg-2 border-border text-fg-2 hover:bg-bg-3'"
          @click="toggleSomeday"
        >☁ Someday</button>
      </div>
    </div>

    <!-- Priority -->
    <div v-if="pendingPriority !== undefined">
      <button
        class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg-2/80 transition-colors"
        :class="activeSection === 'priority' ? 'bg-bg-2/80' : ''"
        @click="toggleSection('priority')"
      >
        <span class="text-sm text-fg-2">Priority</span>
        <span class="text-xs font-medium px-2 py-0.5 rounded-lg border" :class="priorityColor">{{ prioritySummary }}</span>
      </button>
      <div v-if="activeSection === 'priority'" class="px-3 pb-3 pt-1">
        <div class="flex gap-2">
          <button
            v-for="p in PRIORITIES"
            :key="p.value"
            class="flex-1 py-2.5 text-xs font-medium border rounded-xl transition-colors"
            :class="[p.color, pendingPriority === p.value ? 'ring-2 ring-primary' : '']"
            @click="pendingPriority = p.value"
          >{{ p.label }}</button>
        </div>
      </div>
    </div>

    <!-- Effort -->
    <div v-if="pendingEffort !== undefined">
      <button
        class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg-2/80 transition-colors"
        :class="activeSection === 'effort' ? 'bg-bg-2/80' : ''"
        @click="toggleSection('effort')"
      >
        <span class="text-sm text-fg-2">Effort</span>
        <span class="text-sm text-fg-4">{{ effortSummary }}</span>
      </button>
      <div v-if="activeSection === 'effort'" class="px-3 pb-3 pt-1">
        <div class="flex gap-2">
          <button
            v-for="e in EFFORTS"
            :key="e.value"
            class="flex-1 py-2.5 text-xs font-medium border border-border rounded-xl text-fg-2 hover:bg-bg-3 transition-colors"
            :class="pendingEffort === e.value ? 'bg-bg-3 ring-2 ring-primary' : 'bg-bg-2'"
            @click="pendingEffort = e.value"
          >{{ e.label }}</button>
        </div>
      </div>
    </div>

  </div>

  <!-- Delete -->
  <button
    class="flex items-center justify-center w-full py-3 text-sm font-medium rounded-xl border border-danger/40 bg-danger/15 text-danger hover:bg-danger/20 transition-colors"
    @click="deleteItem"
  >✕ Delete task</button>

  <!-- Cancel / OK -->
  <div class="flex gap-3 pt-1">
    <button
      class="flex-1 py-3 text-sm font-medium text-fg-3 hover:text-fg transition-colors border border-border rounded-xl"
      @click="close()"
    >Cancel</button>
    <button
      class="flex-1 py-3 text-sm font-semibold bg-primary hover:bg-primary text-white rounded-xl transition-colors"
      @click="confirm"
    >OK</button>
  </div>
</template>
