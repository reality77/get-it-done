<script setup lang="ts">
import { ref, useSlots } from 'vue'
import type { ChecklistItem, ChecklistItemId, SwipeActionDef, ButtonActionDef } from '../../types'
import { useSwipeAction } from '../../composables/useSwipeAction'
import { useEditableField } from '../../composables/useEditableField'
import { makeKeydownHandler } from '../../composables/useKeyboardConfirm'
import PriorityBadge from './PriorityBadge.vue'
import EffortBadge from './EffortBadge.vue'
import AppCheckbox from '../atoms/AppCheckbox.vue'
import TaskCardActions from './TaskCardActions.vue'
import TaskCardMobileSheet from './TaskCardMobileSheet.vue'

const props = defineProps<{
  item: ChecklistItem
  checklistId: string
  checklistTitle: string
  compact?: boolean
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
}>()

const emit = defineEmits<{
  (e: 'toggle-done', id: ChecklistItemId): void
  (e: 'update-text', id: ChecklistItemId, text: string): void
}>()

const slots = useSlots()

// ── Text editing ──────────────────────────────────────────────────────────────
const { isEditing, editText: editTitle, startEdit, confirmEdit, cancelEdit } = useEditableField(
  () => props.item.text,
  (text) => {
    if (text !== props.item.text) {
      emit('update-text', { checklistId: props.checklistId, itemId: props.item.id }, text)
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
      class="absolute inset-0 flex items-center justify-end px-3 pointer-events-none"
      :class="swipeLeft.bgClass"
      :style="{ opacity: leftProgress * 0.9 }"
    >
      <span class="text-white text-xs font-medium">{{ swipeLeft.hint }}</span>
    </div>

    <!-- Row content -->
    <div
      class="flex items-center gap-2 group rounded-lg hover:bg-zinc-800/50 transition-colors bg-zinc-900"
      :class="compact ? 'py-1.5 px-2' : 'py-2 px-3'"
      :style="rowStyle"
    >
      <!-- Completion checkbox -->
      <AppCheckbox
        v-if="showCheckbox !== false"
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
          class="text-sm wrap-break-word block cursor-text"
          :class="item.done ? 'line-through text-zinc-600' : 'text-zinc-200'"
          @dblclick="startEdit()"
        >
          {{ item.text }}
        </span>
        <span v-if="!compact" class="text-[10px] text-zinc-600 block truncate">{{ checklistTitle }}</span>
      </div>

      <!-- Badges -->
      <PriorityBadge v-if="compact && item.priority" :priority="item.priority" />
      <EffortBadge v-if="item.effort" :effort="item.effort" />

      <!-- Actions -->
      <TaskCardActions
        v-if="hasActions() || hasMobileSheet()"
        :actions="actions ?? []"
        :has-mobile-sheet="hasMobileSheet()"
        @open-mobile-menu="mobileMenuOpen = true"
      />
    </div>
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
