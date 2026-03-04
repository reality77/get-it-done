<script setup lang="ts">
import { ref } from 'vue'
import type { ChecklistItem, ChecklistItemId } from '../../types'
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
}>()

const emit = defineEmits<{
  (e: 'toggle-done', id: ChecklistItemId): void
  (e: 'snooze', id: ChecklistItemId, date: string): void
  (e: 'someday', id: ChecklistItemId): void
  (e: 'activate', id: ChecklistItemId): void
  (e: 'delete', id: ChecklistItemId): void
  (e: 'update-text', id: ChecklistItemId, text: string): void
}>()

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
</script>

<template>
  <div
    class="flex items-center gap-2 group rounded-lg transition-colors hover:bg-zinc-800/50"
    :class="compact ? 'py-1.5 px-2' : 'py-2 px-3'"
  >
    <!-- Completion checkbox -->
    <AppCheckbox
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
        class="text-sm cursor-text truncate block"
        :class="item.done ? 'line-through text-zinc-600' : 'text-zinc-200'"
        @dblclick="startEdit"
      >
        {{ item.text }}
      </span>
      <span v-if="!compact" class="text-[10px] text-zinc-600 block truncate">{{ checklistTitle }}</span>
    </div>

    <!-- Badges -->
    <PriorityBadge v-if="!compact && item.priority" :priority="item.priority" />
    <EffortBadge v-if="!compact && item.effort" :effort="item.effort" />

    <!-- Actions (always visible on mobile, hover-reveal on desktop) -->
    <div class="flex items-center gap-1 transition-opacity shrink-0 relative sm:opacity-0 sm:group-hover:opacity-100">
      <!-- Activate (for snoozed/someday items) -->
      <AppButton
        v-if="itemStatus() !== 'active'"
        variant="icon"
        title="Activate"
        @click="emit('activate', { checklistId, itemId: item.id })"
      >
        ↩
      </AppButton>

      <!-- Snooze -->
      <AppButton
        v-if="itemStatus() === 'active'"
        variant="icon"
        title="Snooze"
        @click="snoozeOpen = !snoozeOpen"
      >
        💤
      </AppButton>

      <!-- Someday -->
      <AppButton
        v-if="itemStatus() === 'active'"
        variant="icon"
        title="Move to someday"
        @click="emit('someday', { checklistId, itemId: item.id })"
      >
        ☁
      </AppButton>

      <!-- Delete -->
      <AppButton
        variant="danger"
        title="Delete"
        @click="emit('delete', { checklistId, itemId: item.id })"
      >
        ✕
      </AppButton>

      <!-- Snooze menu -->
      <SnoozeMenu
        v-if="snoozeOpen"
        class="absolute right-0 top-full mt-1 z-10"
        @pick="onSnooze"
        @cancel="snoozeOpen = false"
      />
    </div>
  </div>
</template>
