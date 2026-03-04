<script setup lang="ts">
import { ref } from 'vue'
import type { Task } from '../../types'
import TaskStatusDot from '../atoms/TaskStatusDot.vue'
import AppButton from '../atoms/AppButton.vue'
import SnoozeMenu from './SnoozeMenu.vue'

const props = defineProps<{
  task: Task
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'snooze', taskId: string, date: string): void
  (e: 'someday', taskId: string): void
  (e: 'activate', taskId: string): void
  (e: 'delete', taskId: string): void
  (e: 'update', taskId: string, patch: Partial<Pick<Task, 'title' | 'priority' | 'effort'>>): void
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
  editTitle.value = props.task.title
}

function confirmEdit(): void {
  const title = editTitle.value.trim()
  if (title && title !== props.task.title) {
    emit('update', props.task.id, { title })
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
  emit('snooze', props.task.id, date)
}

const priorityColors: Record<string, string> = {
  urgent: 'text-red-400 bg-red-950',
  important: 'text-yellow-400 bg-yellow-950',
  secondary: 'text-zinc-400 bg-zinc-800',
}

const effortColors: Record<string, string> = {
  small: 'text-emerald-400 bg-emerald-950',
  medium: 'text-blue-400 bg-blue-950',
  large: 'text-orange-400 bg-orange-950',
}
</script>

<template>
  <div
    class="flex items-center gap-2 group rounded-lg transition-colors hover:bg-zinc-800/50"
    :class="compact ? 'py-1.5 px-2' : 'py-2 px-3'"
  >
    <TaskStatusDot :status="task.status" />

    <!-- Title -->
    <input
      v-if="isEditing"
      v-focus
      v-model="editTitle"
      class="flex-1 bg-transparent border-b border-zinc-700 focus:border-violet-500 outline-none text-zinc-100 text-sm py-0.5 transition-colors"
      @keydown="onKeydown"
      @blur="confirmEdit"
    />
    <span
      v-else
      class="flex-1 text-sm text-zinc-200 cursor-text truncate min-w-0"
      @dblclick="startEdit"
    >
      {{ task.title }}
    </span>

    <!-- Badges -->
    <span
      v-if="!compact"
      class="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
      :class="priorityColors[task.priority]"
    >
      {{ task.priority }}
    </span>
    <span
      v-if="!compact"
      class="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
      :class="effortColors[task.effort]"
    >
      {{ task.effort }}
    </span>

    <!-- Actions (visible on hover) -->
    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 relative">
      <!-- Activate (for snoozed/someday tasks) -->
      <AppButton
        v-if="task.status !== 'active'"
        variant="icon"
        title="Activate"
        @click="$emit('activate', task.id)"
      >
        ↩
      </AppButton>

      <!-- Snooze -->
      <AppButton
        v-if="task.status === 'active'"
        variant="icon"
        title="Snooze"
        @click="snoozeOpen = !snoozeOpen"
      >
        💤
      </AppButton>

      <!-- Someday -->
      <AppButton
        v-if="task.status === 'active'"
        variant="icon"
        title="Move to someday"
        @click="$emit('someday', task.id)"
      >
        ☁
      </AppButton>

      <!-- Delete -->
      <AppButton
        variant="danger"
        title="Delete"
        @click="$emit('delete', task.id)"
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
