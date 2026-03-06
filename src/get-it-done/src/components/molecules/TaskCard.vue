<script setup lang="ts">
import { ref, useSlots } from 'vue'
import type { ChecklistItem, ChecklistItemId, SwipeActionDef, ButtonActionDef } from '../../types'
import { useSwipeAction } from '../../composables/useSwipeAction'
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
  /** Show the completion checkbox (default: true) */
  showCheckbox?: boolean
  /** Swipe-left action — triggers when the user swipes left */
  swipeLeft?: SwipeActionDef
  /** Swipe-right action — triggers when the user swipes right */
  swipeRight?: SwipeActionDef
  /** Desktop hover buttons (and mobile inline buttons when no mobile-sheet slot) */
  actions?: ButtonActionDef[]
}>()

const emit = defineEmits<{
  (e: 'toggle-done', id: ChecklistItemId): void
  (e: 'update-text', id: ChecklistItemId, text: string): void
}>()

const slots = useSlots()

// ── Text editing ──────────────────────────────────────────────────────────────
const isEditing = ref(false)
const editTitle = ref('')

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

// ── Mobile sheet ──────────────────────────────────────────────────────────────
const mobileMenuOpen = ref(false)

function closeMobileMenu(): void {
  mobileMenuOpen.value = false
}

// ── Snooze dropdown (desktop action bar) ──────────────────────────────────────
const openSnoozeIdx = ref<number | null>(null)

// ── Swipe gesture ─────────────────────────────────────────────────────────────
const rowEl = ref<HTMLElement | null>(null)

const { style: rowStyle, rightProgress, leftProgress } = useSwipeAction(rowEl, {
  threshold: 72,
  guard: () => !!(props.swipeLeft || props.swipeRight),
  onLeft: () => props.swipeLeft?.onTrigger(),
  onRight: () => props.swipeRight?.onTrigger(),
})

const hasMobileSheet = () => !!slots['mobile-sheet']
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

      <!-- Actions area -->
      <div v-if="hasActions() || hasMobileSheet()" class="flex items-center gap-1 shrink-0 relative">

        <!-- Mobile ⋯ trigger (only when mobile-sheet slot is provided) -->
        <AppButton
          v-if="hasMobileSheet()"
          class="sm:hidden"
          variant="icon"
          title="Actions"
          @click="mobileMenuOpen = true"
        >
          ⋯
        </AppButton>

        <!-- Action buttons:
             - when mobile-sheet slot: desktop-only (sm:flex), hover-reveal
             - when no slot: always visible on mobile (flex), hover-reveal on desktop -->
        <div
          v-if="hasActions()"
          class="items-center gap-1 transition-opacity relative"
          :class="hasMobileSheet()
            ? 'hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100'
            : 'flex sm:opacity-0 sm:group-hover:opacity-100'"
        >
          <template v-for="(action, i) in actions" :key="i">
            <!-- Snooze button with dropdown -->
            <div v-if="action.snooze" class="relative">
              <AppButton
                variant="icon"
                :title="action.title"
                @click="openSnoozeIdx = openSnoozeIdx === i ? null : i"
              >{{ action.label }}</AppButton>
              <SnoozeMenu
                v-if="openSnoozeIdx === i"
                class="absolute right-0 top-full mt-1 z-10"
                @pick="(date) => { action.snooze!(date); openSnoozeIdx = null }"
                @cancel="openSnoozeIdx = null"
              />
            </div>
            <!-- Regular button -->
            <AppButton
              v-else
              :variant="action.variant ?? 'icon'"
              :title="action.title"
              @click="action.onClick?.()"
            >{{ action.label }}</AppButton>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Mobile bottom sheet -->
  <Teleport to="body">
    <div
      v-if="mobileMenuOpen"
      class="fixed inset-0 z-50 flex items-end sm:hidden"
    >
      <div class="absolute inset-0 bg-black/60" @click="closeMobileMenu" />

      <div class="relative w-full bg-zinc-900 border-t border-zinc-700 rounded-t-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto">
        <!-- Task title -->
        <p class="text-sm font-medium text-zinc-200 truncate border-b border-zinc-800 pb-3">{{ item.text }}</p>

        <!-- Custom slot content OR default action list + Cancel -->
        <slot name="mobile-sheet" :close="closeMobileMenu">
          <!-- Default: render actions as full-width touch-friendly rows -->
          <div v-if="actions?.length" class="space-y-2">
            <button
              v-for="(action, i) in actions"
              :key="i"
              class="flex items-center justify-center w-full py-3 text-sm font-medium rounded-xl border transition-colors"
              :class="action.variant === 'danger'
                ? 'border-red-800/60 bg-red-900/20 text-red-400 hover:bg-red-900/30'
                : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'"
              @click="action.onClick?.(); closeMobileMenu()"
            >
              {{ action.label }}<span v-if="action.title" class="ml-1 text-zinc-500 text-xs">&nbsp;{{ action.title }}</span>
            </button>
          </div>
          <!-- Default Cancel -->
          <button
            class="flex items-center justify-center w-full py-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 rounded-xl"
            @click="closeMobileMenu"
          >
            Cancel
          </button>
        </slot>
      </div>
    </div>
  </Teleport>
</template>
