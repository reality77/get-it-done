<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import type { ChecklistItem, SwipeActionDef, ButtonActionDef } from '../../types'
import { useSwipeAction } from '../../composables/useSwipeAction'
import { useEditableField } from '../../composables/useEditableField'
import { makeKeydownHandler } from '../../composables/useKeyboardConfirm'
import { useChecklistStore } from '../../stores/checklists'
import PriorityBadge from './PriorityBadge.vue'
import EffortBadge from './EffortBadge.vue'
import AppCheckbox from '../atoms/AppCheckbox.vue'
import DeadlineBar from '../atoms/DeadlineBar.vue'
import TaskCardActions from './TaskCardActions.vue'
import TaskCardMobileSheet from './TaskCardMobileSheet.vue'
import VCard from '../atoms/VCard.vue'

const props = defineProps<{
  item: ChecklistItem
  checklistId: string
  checklistTitle: string
  compact?: boolean
  /** Override checklist title visibility; defaults to true when non-compact, false when compact */
  showChecklistTitle?: boolean
  /** Show the completion checkbox (default: true) */
  showCheckbox?: boolean
  /** Swipe-left action — triggers when the user swipes left */
  swipeLeft?: SwipeActionDef
  /** Swipe-right action — triggers when the user swipes right */
  swipeRight?: SwipeActionDef
  /** Desktop hover buttons (and mobile inline buttons when no mobile-sheet slot) */
  actions?: ButtonActionDef[]
  /** Collapse actions into a ⋯ sheet on mobile */
  collapseMobileActions?: boolean
  /** When true, the item represents the whole checklist as a single task */
  isChecklistTask?: boolean
  /** Progress counter for checklist tasks */
  progress?: { done: number; total: number }
  /** Called instead of toggleItem when isChecklistTask is true */
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

// ── Swipe gesture ─────────────────────────────────────────────────────────────
const rowEl = ref<HTMLElement | null>(null)

const { style: rowStyle, rightProgress, leftProgress } = useSwipeAction(rowEl, {
  threshold: 72,
  guard: () => !!(props.swipeLeft || props.swipeRight),
  onLeft: () => props.swipeLeft?.onTrigger(),
  onRight: () => props.swipeRight?.onTrigger(),
})

const hasMobileSheet = () => !!slots['mobile-sheet'] || !!(props.collapseMobileActions && props.actions?.length)
const hasActions = () => !!(props.actions?.length)

const deadline = computed(() => props.item.deadline ? new Date(props.item.deadline) : null)

</script>

<template>
  <!-- Swipe wrapper -->
  <div ref="rowEl" class="relative overflow-hidden rounded-lg">

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

    <!-- Row content -->
    <VCard
      class="relative flex group rounded-lg hover:bg-bg-2/50 transition-colors bg-bg-1"
      :style="rowStyle"
    >
      <div class="flex flex-col w-full">
        <div class="flex flex-row items-center gap-2"
        :class="compact ? 'py-1.5 px-2' : 'py-4 px-4'">

      <!-- Completion checkbox -->
      <AppCheckbox
        v-if="showCheckbox !== false"
        :model-value="item.done"
        @update:model-value="isChecklistTask ? onChecklistDone?.() : store.toggleItem({ checklistId, itemId: item.id })"
      />

      <!-- Title -->
      <input
        v-if="isEditing"
        v-focus
        v-model="editTitle"
        class="flex-1 bg-transparent border-b border-border focus:border-primary outline-none text-fg text-sm py-0.5 transition-colors"
        @keydown="onKeydown"
        @blur="confirmEdit"
      />
      <div v-else class="flex-1 min-w-0">
        <span
          class="text-sm wrap-break-word block cursor-text"
          :class="item.done ? 'line-through text-fg-4' : 'text-fg'"
          @dblclick="startEdit()"
        >
          {{ item.text }}
        </span>
        <span v-if="showChecklistTitle !== undefined ? showChecklistTitle : !compact" class="text-xs text-fg-4 block truncate">{{ checklistTitle }}</span>
      </div>

      <!-- Progress badge for checklist tasks -->
      <span
        v-if="progress"
        class="text-xs text-fg-4 shrink-0 tabular-nums"
      >{{ progress.done }}/{{ progress.total }}</span>

      <!-- Badges -->
    <PriorityBadge v-if="item.priority" :priority="item.priority" :compact="true"></PriorityBadge>
    <EffortBadge v-if="item.effort" :effort="item.effort" />

    <!-- Actions -->
    <TaskCardActions
      v-if="hasActions() || hasMobileSheet()"
      :actions="actions ?? []"
      :has-mobile-sheet="hasMobileSheet()"
      @open-mobile-menu="mobileMenuOpen = true"
    />

      </div>
      <div v-if="deadline && item.deadline && !item.done" elevated class="opacity-50 px-3 py-1 bg-bg-2 flex flex-row items-center rounded-md overflow-hidden">
          <!-- Deadline proximity bar -->
          <DeadlineBar :deadline="item.deadline" />
          <div class="flex-1 flex justify-end px-2">
            <span class="block w-full text-right whitespace-nowrap">
              <span v-if="deadline.getFullYear() > new Date().getFullYear()">{{ deadline.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }}</span>
              <span v-else :class="deadline.getTime() < new Date().getTime() ? 'text-danger' : ''">{{ deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }}</span>
            </span>
          </div>
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
