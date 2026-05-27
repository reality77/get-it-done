<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import type { ChecklistItem, SwipeActionDef, ButtonActionDef } from '../../types'
import { useSwipeAction } from '../../composables/useSwipeAction'
import { useEditableField } from '../../composables/useEditableField'
import { makeKeydownHandler } from '../../composables/useKeyboardConfirm'
import { useChecklistStore } from '../../stores/checklists'
import TaskCardActions from './TaskCardActions.vue'
import TaskCardMobileSheet from './TaskCardMobileSheet.vue'
import EffortBadge from './EffortBadge.vue'
import VCard from '../atoms/VCard.vue'

const props = defineProps<{
  item: ChecklistItem
  checklistId: string
  checklistTitle: string
  compact?: boolean
  showChecklistTitle?: boolean
  showCheckbox?: boolean
  swipeLeft?: SwipeActionDef
  swipeRight?: SwipeActionDef
  actions?: ButtonActionDef[]
  collapseMobileActions?: boolean
  isChecklistTask?: boolean
  progress?: { done: number; total: number }
  onChecklistDone?: () => void
}>()

const slots = useSlots()
const store = useChecklistStore()

// ── Text editing ──────────────────────────────────────────────────────────────
const { isEditing, editText: editTitle, startEdit, confirmEdit, cancelEdit } = useEditableField(
  () => props.item.text,
  (text) => {
    if (text !== props.item.text) {
      store.updateItemText({ checklistId: props.checklistId, itemId: props.item.id }, text)
    }
  },
)

const onKeydown = makeKeydownHandler(confirmEdit, cancelEdit)

// ── Mobile sheet ──────────────────────────────────────────────────────────────
const mobileMenuOpen = ref(false)

const hasMobileSheet = computed(() =>
  !!slots['mobile-sheet'] || !!(props.collapseMobileActions && props.actions?.length)
)

function handleCardClick(): void {
  if (hasMobileSheet.value) {
    mobileMenuOpen.value = true
  }
}

// ── Swipe gesture ─────────────────────────────────────────────────────────────
const rowEl = ref<HTMLElement | null>(null)

const { style: rowStyle, rightProgress, leftProgress } = useSwipeAction(rowEl, {
  threshold: 72,
  guard: () => !!(props.swipeLeft || props.swipeRight),
  onLeft: () => props.swipeLeft?.onTrigger(),
  onRight: () => props.swipeRight?.onTrigger(),
})

// ── Priority bar ──────────────────────────────────────────────────────────────
const priorityBarClass = computed(() => {
  if (props.item.done) return 'bg-fg-4/30'
  switch (props.item.priority) {
    case 'urgent': return 'bg-danger'
    case 'important': return 'bg-warning'
    case 'secondary': return 'bg-fg-3'
    default: return 'bg-transparent'
  }
})

// ── Date badge ────────────────────────────────────────────────────────────────
const dateInfo = computed(() => {
  if (props.item.done) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const raw = props.item.deadline ?? props.item.snoozeUntil
  if (!raw) return null
  const d = new Date(raw)
  d.setHours(0, 0, 0, 0)
  const isUrgent = d.getTime() <= today.getTime()
  const label = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return { label, danger: isUrgent }
})

// ── Progress dots (up to 5) ───────────────────────────────────────────────────
const progressDots = computed(() => {
  if (!props.progress || props.progress.total === 0) return null
  const { done, total } = props.progress
  const max = Math.min(total, 5)
  const doneDots = Math.round((done / total) * max)
  return Array.from({ length: max }, (_, i) => i < doneDots)
})
</script>

<template>
  <!-- Swipe wrapper -->
  <div ref="rowEl" class="relative overflow-hidden rounded-xl">

    <!-- Left hint (revealed on swipe right) -->
    <div
      v-if="swipeRight"
      class="absolute inset-0 flex items-center px-3 pointer-events-none"
      :class="swipeRight.bgClass"
      :style="{ opacity: rightProgress * 0.9 }"
    >
      <span class="text-white text-xs font-medium">{{ swipeRight.hint }}</span>
    </div>

    <!-- Right hint (revealed on swipe left) -->
    <div
      v-if="swipeLeft"
      class="absolute inset-0 flex items-center justify-end pointer-events-none"
      :class="swipeLeft.bgClass"
      :style="{ opacity: leftProgress * 0.9 }"
    >
      <span class="text-white text-xs font-medium">{{ swipeLeft.hint }}</span>
    </div>

    <!-- Card -->
    <VCard
      class="relative flex group overflow-hidden transition-colors cursor-pointer"
      :style="rowStyle"
      @click="handleCardClick"
    >
      <!-- Priority bar -->
      <div class="w-1 shrink-0 self-stretch" :class="priorityBarClass" />

      <!-- Content -->
      <div class="flex-1 flex flex-col min-w-0" :class="compact ? 'py-2 px-3' : 'py-3 px-3'">

        <!-- Title row -->
        <div class="flex items-start gap-2">
          <input
            v-if="isEditing"
            v-focus
            v-model="editTitle"
            class="flex-1 bg-transparent border-b border-border focus:border-primary outline-none text-fg py-0.5 transition-colors"
            :class="compact ? 'text-sm' : 'text-base'"
            @keydown="onKeydown"
            @blur="confirmEdit"
            @click.stop
          />
          <span
            v-else
            class="flex-1 wrap-break-word leading-snug"
            :class="[
              compact ? 'text-sm' : 'text-base font-medium',
              item.done ? 'line-through text-fg-4' : 'text-fg',
            ]"
            @dblclick.stop="startEdit()"
          >{{ item.text }}</span>

          <!-- Desktop hover actions (hidden on mobile) -->
          <div
            v-if="actions?.length"
            class="hidden sm:flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            @click.stop
          >
            <TaskCardActions :actions="actions" :has-mobile-sheet="false" />
          </div>
        </div>

        <!-- Meta row: checklist name + icons + date + effort -->
        <div class="flex items-center gap-1.5 mt-1.5 min-w-0">
          <!-- Checklist title -->
          <span
            v-if="showChecklistTitle !== undefined ? showChecklistTitle : true"
            class="text-xs text-fg-4 flex-1 truncate min-w-0"
          >{{ checklistTitle }}</span>
          <span v-else class="flex-1" />

          <!-- Link icon -->
          <svg
            v-if="item.url"
            class="w-3.5 h-3.5 text-fg-4 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l1.5-1.5a3.5 3.5 0 0 0-4.95-4.95l-.75.75" />
            <path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0L3.05 8a3.5 3.5 0 0 0 4.95 4.95l.75-.75" />
          </svg>

          <!-- Bell icon -->
          <svg
            v-if="item.reminders?.length"
            class="w-3.5 h-3.5 text-fg-4 shrink-0"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8 1.5a.75.75 0 0 1 .75.75v.42A4.5 4.5 0 0 1 12.5 7v2l1 1.5H2.5L3.5 9V7A4.5 4.5 0 0 1 7.25 2.67V2.25A.75.75 0 0 1 8 1.5Zm0 12.5a1.5 1.5 0 0 1-1.5-1.5h3A1.5 1.5 0 0 1 8 14Z" />
          </svg>

          <!-- Comment icon -->
          <svg
            v-if="item.comment"
            class="w-3.5 h-3.5 text-fg-4 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2V3Z" />
          </svg>

          <!-- Progress dots -->
          <div v-if="progressDots" class="flex gap-0.5 items-center shrink-0">
            <span
              v-for="(filled, i) in progressDots"
              :key="i"
              class="w-2 h-2 rounded-full"
              :class="filled ? 'bg-success' : 'bg-fg-4/30'"
            />
          </div>

          <!-- Date badge -->
          <span
            v-if="dateInfo"
            class="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
            :class="dateInfo.danger ? 'bg-danger/20 text-danger' : 'bg-bg-3 text-fg-3'"
          >
            <span class="opacity-60">—</span>
            {{ dateInfo.label }}
          </span>

          <!-- Effort badge -->
          <EffortBadge v-if="item.effort" :effort="item.effort" />
        </div>
      </div>
    </VCard>
  </div>

  <!-- Mobile bottom sheet -->
  <TaskCardMobileSheet
    :item="item"
    :actions="actions"
    :open="mobileMenuOpen"
    @close="mobileMenuOpen = false"
  >
    <template v-if="$slots['mobile-sheet']" #default="slotProps">
      <slot name="mobile-sheet" v-bind="slotProps" />
    </template>
  </TaskCardMobileSheet>
</template>
