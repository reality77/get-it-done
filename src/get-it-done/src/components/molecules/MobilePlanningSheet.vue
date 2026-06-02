<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ChecklistItem, ChecklistItemId, TaskPriority, TaskEffort } from '../../types'
import { useChecklistStore } from '../../stores/checklists'
import VSegmented from '../atoms/VSegmented.vue'

const props = defineProps<{
  item: ChecklistItem
  itemId: ChecklistItemId
  close: () => void
  isChecklistTask?: boolean
  onComplete?: () => void
}>()

const store = useChecklistStore()

// ── Tabs ──────────────────────────────────────────────────────────────────────
const activeTab = ref<'details' | 'actions'>('details')

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

// ── Priority / Effort ─────────────────────────────────────────────────────────
const pendingPriority = ref<TaskPriority | undefined>(props.item.priority)
const pendingEffort = ref<TaskEffort | undefined>(props.item.effort)

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent',    label: 'Urgent',    color: 'bg-danger/20 text-danger border-danger/40' },
  { value: 'important', label: 'Important', color: 'bg-warning/20 text-warning border-warning/40' },
  { value: 'secondary', label: 'Secondary', color: 'bg-bg-3/60 text-fg-3 border-border' },
]

const EFFORTS: { value: TaskEffort; label: string; short: string }[] = [
  { value: 'small',  label: 'Small',  short: 'S' },
  { value: 'medium', label: 'Medium', short: 'M' },
  { value: 'large',  label: 'Large',  short: 'L' },
]

// ── Comment / URL inline editing ──────────────────────────────────────────────
const pendingComment = ref(props.item.comment ?? '')
const pendingUrl = ref(props.item.url ?? '')
const isEditingComment = ref(false)
const isEditingUrl = ref(false)

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
const showReminders = ref(false)

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
const remindersSummary = computed(() => {
  const n = pendingReminders.value.length
  if (n === 0) return '—'
  if (n === 1) return formatReminder(pendingReminders.value[0]!)
  return `${n} reminders`
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

// ── Confirm ───────────────────────────────────────────────────────────────────
function confirm(): void {
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

// ── Actions tab ───────────────────────────────────────────────────────────────
function completeTask(): void {
  if (props.item.done && props.isChecklistTask) {
    store.unarchiveChecklist(props.itemId.checklistId)
  } else if (!props.item.done && props.isChecklistTask && props.onComplete) {
    props.onComplete()
  } else {
    store.toggleItem(props.itemId)
  }
  props.close()
}

function deleteItem(): void {
  store.removeItem(props.itemId)
  props.close()
}
</script>

<template>
  <!-- Tab selector -->
  <VSegmented
    v-model="activeTab"
    :options="[{ value: 'details', label: 'Details' }, { value: 'actions', label: 'Actions' }]"
    class="mb-3"
  />

  <!-- ── Details tab ─────────────────────────────────────────────────────────── -->
  <template v-if="activeTab === 'details'">
    <!-- Editable title -->
    <div class="border-b border-hairline pb-3 mb-2">
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

    <!-- Fields -->
    <div class="space-y-0.5">

      <!-- Priority (inline buttons) -->
      <div v-if="pendingPriority !== undefined" class="flex items-center justify-between px-3 py-2">
        <span class="text-sm text-fg-2 shrink-0">Priority</span>
        <div class="flex gap-1.5">
          <button
            v-for="p in PRIORITIES"
            :key="p.value"
            class="px-2.5 py-1 text-xs font-medium border rounded-lg transition-all"
            :class="[p.color, pendingPriority === p.value ? 'ring-2 ring-offset-1 ring-offset-bg-1 ring-primary/60' : 'opacity-50 hover:opacity-90']"
            @click="pendingPriority = p.value"
          >{{ p.label }}</button>
        </div>
      </div>

      <!-- Effort (inline S / M / L) -->
      <div v-if="pendingEffort !== undefined" class="flex items-center justify-between px-3 py-2">
        <span class="text-sm text-fg-2 shrink-0">Effort</span>
        <div class="flex gap-1.5">
          <button
            v-for="e in EFFORTS"
            :key="e.value"
            class="w-10 py-1 text-xs font-semibold border rounded-lg transition-all text-center"
            :class="pendingEffort === e.value
              ? 'bg-primary/20 border-primary text-primary ring-2 ring-offset-1 ring-offset-bg-1 ring-primary/60'
              : 'bg-bg-2 border-border text-fg-3 hover:bg-bg-3 hover:text-fg-2'"
            :title="e.label"
            @click="pendingEffort = e.value"
          >{{ e.short }}</button>
        </div>
      </div>

      <!-- Deadline (direct input, no accordion) -->
      <div class="px-3 py-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm text-fg-2 shrink-0">📅 Deadline</span>
          <div class="flex items-center gap-2">
            <input
              type="date"
              v-model="pendingDeadlineDate"
              class="bg-bg-2 border border-border rounded-xl px-3 py-1.5 text-sm text-fg-2 focus:border-primary focus:outline-none transition-colors"
            />
            <button
              v-if="pendingDeadlineDate"
              class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-fg-4 hover:text-fg-2 hover:bg-bg-2 transition-colors text-xs"
              @click.stop="clearDeadline"
            >✕</button>
          </div>
        </div>
        <div v-if="pendingDeadlineDate" class="flex items-center gap-3 mt-2 pl-1">
          <label class="flex items-center gap-1.5 text-xs text-fg-3 cursor-pointer select-none">
            <input type="checkbox" v-model="deadlineHasTime" class="accent-primary rounded" />
            Add time
          </label>
          <input
            v-if="deadlineHasTime"
            type="time"
            v-model="pendingDeadlineTime"
            class="bg-bg-2 border border-border rounded-xl px-3 py-1.5 text-sm text-fg-2 focus:border-primary focus:outline-none transition-colors"
          />
        </div>
      </div>

      <!-- Comment (replaces row when editing) -->
      <div class="px-3 py-2">
        <textarea
          v-if="isEditingComment"
          v-focus
          v-model="pendingComment"
          rows="3"
          placeholder="Add a note…"
          class="w-full bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-fg-2 placeholder-fg-4 focus:border-primary focus:outline-none transition-colors resize-none"
          @blur="isEditingComment = false"
        />
        <button
          v-else
          class="w-full flex items-center justify-between rounded-lg hover:bg-bg-2/60 transition-colors -mx-1 px-1 py-1"
          @click="isEditingComment = true"
        >
          <span class="text-sm text-fg-2">💬 Comment</span>
          <span
            class="text-sm truncate max-w-[150px] text-right ml-2"
            :class="pendingComment.trim() ? 'text-primary' : 'text-fg-4'"
          >{{ commentSummary }}</span>
        </button>
      </div>

      <!-- URL (replaces row when editing) -->
      <div class="px-3 py-2">
        <input
          v-if="isEditingUrl"
          v-focus
          type="url"
          v-model="pendingUrl"
          placeholder="https://…"
          class="w-full bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-fg-2 placeholder-fg-4 focus:border-primary focus:outline-none transition-colors"
          @blur="isEditingUrl = false"
          @keydown.enter.prevent="isEditingUrl = false"
        />
        <button
          v-else
          class="w-full flex items-center justify-between rounded-lg hover:bg-bg-2/60 transition-colors -mx-1 px-1 py-1"
          @click="isEditingUrl = true"
        >
          <span class="text-sm text-fg-2">🔗 URL</span>
          <span
            class="text-sm truncate max-w-[150px] text-right ml-2"
            :class="pendingUrl.trim() ? 'text-primary' : 'text-fg-4'"
          >{{ urlSummary }}</span>
        </button>
      </div>

      <!-- Reminders (accordion) -->
      <div>
        <button
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg-2/80 transition-colors"
          :class="showReminders ? 'bg-bg-2/80' : ''"
          @click="showReminders = !showReminders"
        >
          <span class="text-sm text-fg-2">🔔 Reminders</span>
          <span class="text-sm" :class="pendingReminders.length > 0 ? 'text-primary' : 'text-fg-4'">{{ remindersSummary }}</span>
        </button>
        <div v-if="showReminders" class="px-3 pb-3 pt-1 space-y-2">
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

    </div>

    <!-- Cancel / OK -->
    <div class="flex gap-3 pt-3">
      <button
        class="flex-1 py-3 text-sm font-medium text-fg-3 hover:text-fg transition-colors border border-border rounded-xl"
        @click="close()"
      >Cancel</button>
      <button
        class="flex-1 py-3 text-sm font-semibold bg-primary text-white rounded-xl transition-colors hover:opacity-90"
        @click="confirm"
      >OK</button>
    </div>
  </template>

  <!-- ── Actions tab ─────────────────────────────────────────────────────────── -->
  <template v-if="activeTab === 'actions'">
    <div class="space-y-3 pt-1">

      <!-- Complete / Uncomplete -->
      <button
        v-if="item.done"
        class="flex items-center justify-center w-full py-3 text-sm font-medium rounded-xl border transition-colors border-border bg-bg-2 text-fg-2 hover:bg-bg-3"
        @click="completeTask"
      >↩ Mark incomplete</button>
      <template v-else>
        <button
          v-if="!isChecklistTask"
          class="flex items-center justify-center w-full py-3 text-sm font-medium rounded-xl border transition-colors border-success/40 bg-success/15 text-success hover:bg-success/20"
          @click="completeTask"
        >✓ Complete task</button>
        <button
          v-else-if="onComplete"
          class="flex items-center justify-center w-full py-3 text-sm font-medium rounded-xl border transition-colors border-success/40 bg-success/15 text-success hover:bg-success/20"
          @click="completeTask"
        >✓ Complete checklist</button>
      </template>

      <!-- Delete (not available for checklist tasks) -->
      <button
        v-if="!isChecklistTask"
        class="flex items-center justify-center w-full py-3 text-sm font-medium rounded-xl border border-danger/40 bg-danger/15 text-danger hover:bg-danger/20 transition-colors"
        @click="deleteItem"
      >Delete task</button>

    </div>
  </template>
</template>
