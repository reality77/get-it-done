<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Task, TaskPriority, TaskEffort } from '../../types'
import AppButton from '../atoms/AppButton.vue'
import AppInput from '../atoms/AppInput.vue'

const props = defineProps<{
  task?: Task | null
}>()

const emit = defineEmits<{
  (e: 'submit', title: string, priority: TaskPriority, effort: TaskEffort): void
  (e: 'cancel'): void
}>()

const title = ref(props.task?.title ?? '')
const priority = ref<TaskPriority>(props.task?.priority ?? 'important')
const effort = ref<TaskEffort>(props.task?.effort ?? 'medium')

watch(() => props.task, (task) => {
  title.value = task?.title ?? ''
  priority.value = task?.priority ?? 'important'
  effort.value = task?.effort ?? 'medium'
})

function submit(): void {
  const trimmed = title.value.trim()
  if (!trimmed) return
  emit('submit', trimmed, priority.value, effort.value)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') submit()
  else if (e.key === 'Escape') emit('cancel')
}

const priorities: TaskPriority[] = ['urgent', 'important', 'secondary']
const efforts: TaskEffort[] = ['small', 'medium', 'large']

const priorityLabels: Record<TaskPriority, string> = {
  urgent: 'Urgent',
  important: 'Important',
  secondary: 'Secondary',
}

const effortLabels: Record<TaskEffort, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
    @click.self="$emit('cancel')"
  >
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm">
      <h2 class="text-base font-semibold text-zinc-100 mb-4">
        {{ task ? 'Edit task' : 'New task' }}
      </h2>

      <div class="mb-4">
        <AppInput
          v-model="title"
          placeholder="Task title"
          :autofocus="true"
          @keydown="onKeydown"
        />
      </div>

      <!-- Priority -->
      <div class="mb-4">
        <p class="text-xs text-zinc-500 mb-2">Priority</p>
        <div class="flex gap-2">
          <button
            v-for="p in priorities"
            :key="p"
            class="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            :class="priority === p
              ? 'bg-violet-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'"
            @click="priority = p"
          >
            {{ priorityLabels[p] }}
          </button>
        </div>
      </div>

      <!-- Effort -->
      <div class="mb-6">
        <p class="text-xs text-zinc-500 mb-2">Effort</p>
        <div class="flex gap-2">
          <button
            v-for="ef in efforts"
            :key="ef"
            class="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            :class="effort === ef
              ? 'bg-violet-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'"
            @click="effort = ef"
          >
            {{ effortLabels[ef] }}
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <AppButton variant="secondary" @click="$emit('cancel')">Cancel</AppButton>
        <AppButton variant="primary" :disabled="!title.trim()" @click="submit">
          {{ task ? 'Save' : 'Create' }}
        </AppButton>
      </div>
    </div>
  </div>
</template>
