<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSwipe } from '@vueuse/core'
import type { ChecklistItem, ChecklistItemId, TaskPriority, TaskEffort } from '../../types'
import { getSnoozeOptions } from '../../stores/checklists'
import PriorityBadge from './PriorityBadge.vue'
import EffortBadge from './EffortBadge.vue'
import AppButton from '../atoms/AppButton.vue'
import AppCheckbox from '../atoms/AppCheckbox.vue'
import SnoozeMenu from './SnoozeMenu.vue'

const props = defineProps<{
  item: ChecklistItem
  checklistId: string
  checklistTitle: string
  compact?: boolean
  planningMode?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-done', id: ChecklistItemId): void
  (e: 'snooze', id: ChecklistItemId, date: string): void
  (e: 'someday', id: ChecklistItemId): void
  (e: 'activate', id: ChecklistItemId): void
  (e: 'delete', id: ChecklistItemId): void
  (e: 'update-text', id: ChecklistItemId, text: string): void
  (e: 'update-priority', id: ChecklistItemId, priority: TaskPriority): void
  (e: 'update-effort', id: ChecklistItemId, effort: TaskEffort): void
}>()

// ── Text editing ──────────────────────────────────────────────────────────────
const isEditing = ref(false)
const editTitle = ref('')
const snoozeOpen = ref(false)

const vFocus = {
  mounted(el: Element) {
    const input = el as HTMLInputElement
    input.focus()
    input.select()
  },
}

function startEdit(): void {
  isEditing.value = true
  editTitle.value = props.item.text
}

function confirmEdit(): void {
  const title = editTitle.value.trim()
  if (title && title !== props.item.text) {
    emit('update-text', { checklistId: props.checklistId, itemId: props.item.id }, title)
  }
  isEditing.value = false
}

function cancelEdit(): void {
  isEditing.value = false
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') { e.preventDefault(); confirmEdit() }
  else if (e.key === 'Escape') cancelEdit()
}

function onSnooze(date: string): void {
  snoozeOpen.value = false
  emit('snooze', { checklistId: props.checklistId, itemId: props.item.id }, date)
}

const itemStatus = () => props.item.status ?? 'active'

// ── Mobile planning dialog (pending state) ────────────────────────────────────
const snoozeOptions = getSnoozeOptions()
const mobileMenuOpen = ref(false)
const pendingSnoozeDate = ref<string | null>(null)
const pendingSomeday = ref(false)
const pendingPriority = ref<TaskPriority | undefined>(undefined)
const pendingEffort = ref<TaskEffort | undefined>(undefined)

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

function openMobileMenu(): void {
  pendingSnoozeDate.value = null
  pendingSomeday.value = false
  pendingPriority.value = props.item.priority
  pendingEffort.value = props.item.effort
  mobileMenuOpen.value = true
}

function selectSnooze(date: string): void {
  pendingSnoozeDate.value = pendingSnoozeDate.value === date ? null : date
  pendingSomeday.value = false
}

function toggleSomeday(): void {
  pendingSomeday.value = !pendingSomeday.value
  pendingSnoozeDate.value = null
}

function confirmMobileMenu(): void {
  const id: ChecklistItemId = { checklistId: props.checklistId, itemId: props.item.id }
  if (pendingSnoozeDate.value) {
    emit('snooze', id, pendingSnoozeDate.value)
  } else if (pendingSomeday.value) {
    emit('someday', id)
  }
  if (pendingPriority.value && pendingPriority.value !== props.item.priority) {
    emit('update-priority', id, pendingPriority.value)
  }
  if (pendingEffort.value && pendingEffort.value !== props.item.effort) {
    emit('update-effort', id, pendingEffort.value)
  }
  mobileMenuOpen.value = false
}

// ── Swipe gesture (planning mode, mobile) ─────────────────────────────────────
const rowEl = ref<HTMLElement | null>(null)
const swipeOffset = ref(0)
const SWIPE_THRESHOLD = 72 // px

const { isSwiping, direction, lengthX } = useSwipe(rowEl, {
  threshold: 10,
  onSwipe() {
    if (!props.planningMode) return
    if (direction.value === 'left') {
      // lengthX is positive when swiping left → negate to get negative offset
      swipeOffset.value = Math.max(-lengthX.value, -(SWIPE_THRESHOLD * 1.4))
    } else if (direction.value === 'right') {
      // lengthX is negative when swiping right → negate to get positive offset
      swipeOffset.value = Math.min(-lengthX.value, SWIPE_THRESHOLD * 1.4)
    }
  },
  onSwipeEnd() {
    if (!props.planningMode) return
    const id: ChecklistItemId = { checklistId: props.checklistId, itemId: props.item.id }
    if (swipeOffset.value <= -SWIPE_THRESHOLD) {
      // swiped left enough → snooze 3 days
      const d = new Date()
      d.setDate(d.getDate() + 3)
      emit('snooze', id, d.toISOString().slice(0, 10))
    } else if (swipeOffset.value >= SWIPE_THRESHOLD) {
      // swiped right enough → someday
      emit('someday', id)
    }
    swipeOffset.value = 0
  },
})

const rowStyle = computed(() => ({
  transform: swipeOffset.value !== 0 ? `translateX(${swipeOffset.value}px)` : '',
  transition: isSwiping.value ? 'none' : 'transform 0.2s ease',
}))
// positive = swiped right (someday); negative = swiped left (snooze)
const somedayProgress = computed(() => Math.max(0, Math.min(swipeOffset.value / SWIPE_THRESHOLD, 1)))
const snoozeProgress  = computed(() => Math.max(0, Math.min(-swipeOffset.value / SWIPE_THRESHOLD, 1)))
</script>

<template>
  <!-- Swipe wrapper -->
  <div ref="rowEl" class="relative overflow-hidden rounded-lg">

    <!-- Someday hint (revealed on swipe right) -->
    <div
      v-if="planningMode"
      class="absolute inset-0 bg-sky-700 flex items-center px-3 pointer-events-none"
      :style="{ opacity: somedayProgress * 0.9 }"
    >
      <span class="text-white text-xs font-medium">☁ Someday</span>
    </div>

    <!-- Snooze hint (revealed on swipe left) -->
    <div
      v-if="planningMode"
      class="absolute inset-0 bg-amber-700 flex items-center justify-end px-3 pointer-events-none"
      :style="{ opacity: snoozeProgress * 0.9 }"
    >
      <span class="text-white text-xs font-medium">💤 3 days</span>
    </div>

    <!-- Row content -->
    <div
      class="flex items-center gap-2 group rounded-lg hover:bg-zinc-800/50 transition-colors bg-zinc-900"
      :class="compact ? 'py-1.5 px-2' : 'py-2 px-3'"
      :style="rowStyle"
    >
      <!-- Completion checkbox (hidden in planning mode) -->
      <AppCheckbox
        v-if="planningMode !== true"
        :model-value="item.done"
        @update:model-value="emit('toggle-done', { checklistId, itemId: item.id })"
      />

      <!-- Title -->
      <input
        v-if="isEditing"
        v-focus
        v-model="editTitle"
        class="flex-1 bg-transparent border-b border-zinc-700 focus:border-violet-500 outline-none text-zinc-100 text-sm py-0.5 transition-colors"
        @keydown="onKeydown"
        @blur="confirmEdit"
      />
      <div v-else class="flex-1 min-w-0">
        <span
          class="text-sm break-words block"
          :class="[
            item.done ? 'line-through text-zinc-600' : 'text-zinc-200',
            planningMode !== false ? 'cursor-text' : '',
          ]"
          @dblclick="planningMode !== false ? startEdit() : undefined"
        >
          {{ item.text }}
        </span>
        <span v-if="!compact" class="text-[10px] text-zinc-600 block truncate">{{ checklistTitle }}</span>
      </div>

      <!-- Badges -->
      <PriorityBadge v-if="compact && item.priority" :priority="item.priority" />
      <EffortBadge v-if="item.effort" :effort="item.effort" />

      <!-- Actions -->
      <div v-if="planningMode !== false" class="flex items-center gap-1 shrink-0 relative">

        <!-- Mobile ⋯ trigger (planning mode only) -->
        <AppButton
          v-if="planningMode === true"
          class="sm:hidden"
          variant="icon"
          title="Actions"
          @click="openMobileMenu"
        >
          ⋯
        </AppButton>

        <!-- Desktop buttons (hover-reveal) / non-planning mobile -->
        <div
          class="items-center gap-1 relative transition-opacity"
          :class="planningMode === true
            ? 'hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100'
            : 'flex sm:opacity-0 sm:group-hover:opacity-100'"
        >
          <AppButton
            v-if="itemStatus() !== 'active'"
            variant="icon"
            title="Activate"
            @click="emit('activate', { checklistId, itemId: item.id })"
          >↩</AppButton>

          <AppButton
            v-if="itemStatus() === 'active'"
            variant="icon"
            title="Snooze"
            @click="snoozeOpen = !snoozeOpen"
          >💤</AppButton>

          <AppButton
            v-if="itemStatus() === 'active'"
            variant="icon"
            title="Move to someday"
            @click="emit('someday', { checklistId, itemId: item.id })"
          >☁</AppButton>

          <AppButton
            variant="danger"
            title="Delete"
            @click="emit('delete', { checklistId, itemId: item.id })"
          >✕</AppButton>

          <SnoozeMenu
            v-if="snoozeOpen"
            class="absolute right-0 top-full mt-1 z-10"
            @pick="onSnooze"
            @cancel="snoozeOpen = false"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Mobile planning bottom sheet -->
  <Teleport to="body">
    <div
      v-if="mobileMenuOpen"
      class="fixed inset-0 z-50 flex items-end sm:hidden"
    >
      <div class="absolute inset-0 bg-black/60" @click="mobileMenuOpen = false" />

      <div class="relative w-full bg-zinc-900 border-t border-zinc-700 rounded-t-2xl p-4 space-y-5 max-h-[85vh] overflow-y-auto">
        <!-- Task title -->
        <p class="text-sm font-medium text-zinc-200 truncate border-b border-zinc-800 pb-3">{{ item.text }}</p>

        <!-- Activate (non-active items only) -->
        <div v-if="itemStatus() !== 'active'">
          <button
            class="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium rounded-xl border border-violet-600 bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 transition-colors"
            @click="emit('activate', { checklistId, itemId: item.id }); mobileMenuOpen = false"
          >
            ↩ Activate
          </button>
        </div>

        <!-- Snooze options (open by default) -->
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

        <!-- Someday -->
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
              :class="[
                p.color,
                pendingPriority === p.value ? 'ring-2 ring-violet-500' : '',
              ]"
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
            @click="mobileMenuOpen = false"
          >
            Cancel
          </button>
          <button
            class="flex-1 py-3 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors"
            @click="confirmMobileMenu"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
