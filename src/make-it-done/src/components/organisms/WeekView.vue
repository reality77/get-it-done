<script setup lang="ts">
import { ref } from 'vue'
import type { Task, TaskPriority } from '../../types'
import TaskCard from '../molecules/TaskCard.vue'
import AppButton from '../atoms/AppButton.vue'

defineProps<{
  tasksByPriority: {
    urgent: Task[]
    important: Task[]
    secondary: Task[]
  }
}>()

const emit = defineEmits<{
  (e: 'snooze', taskId: string, date: string): void
  (e: 'someday', taskId: string): void
  (e: 'delete', taskId: string): void
  (e: 'update', taskId: string, patch: Partial<Pick<Task, 'title' | 'priority' | 'effort'>>): void
  (e: 'toggle-day', taskId: string): void
  (e: 'create', priority: TaskPriority): void
}>()

const collapsed = ref<Record<TaskPriority, boolean>>({
  urgent: false,
  important: false,
  secondary: false,
})

const sections: { priority: TaskPriority; label: string; dotColor: string }[] = [
  { priority: 'urgent',    label: 'Urgent',    dotColor: 'bg-red-500' },
  { priority: 'important', label: 'Important', dotColor: 'bg-yellow-500' },
  { priority: 'secondary', label: 'Secondary', dotColor: 'bg-zinc-500' },
]
</script>

<template>
  <div class="space-y-6">
    <section
      v-for="section in sections"
      :key="section.priority"
    >
      <!-- Section header -->
      <div class="flex items-center gap-2 mb-2">
        <span class="w-2 h-2 rounded-full shrink-0" :class="section.dotColor" />
        <button
          class="flex-1 text-left text-sm font-semibold text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
          @click="collapsed[section.priority] = !collapsed[section.priority]"
        >
          {{ section.label }}
          <span class="text-zinc-600 font-normal ml-1">
            ({{ tasksByPriority[section.priority].length }})
          </span>
        </button>
        <AppButton variant="ghost" class="text-xs" @click="$emit('create', section.priority)">
          + New
        </AppButton>
      </div>

      <!-- Tasks -->
      <div v-if="!collapsed[section.priority]" class="space-y-0.5 pl-4">
        <div
          v-if="tasksByPriority[section.priority].length === 0"
          class="text-xs text-zinc-600 py-2"
        >
          No {{ section.label.toLowerCase() }} tasks
        </div>
        <div
          v-for="task in tasksByPriority[section.priority]"
          :key="task.id"
          class="relative"
        >
          <!-- Day plan toggle checkbox -->
          <button
            class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 w-3.5 h-3.5 rounded border transition-colors cursor-pointer"
            :class="task.selectedForToday
              ? 'bg-violet-600 border-violet-600'
              : 'border-zinc-700 hover:border-zinc-500'"
            :title="task.selectedForToday ? 'Remove from today' : 'Add to today'"
            @click="$emit('toggle-day', task.id)"
          >
            <span v-if="task.selectedForToday" class="text-white text-[10px] leading-none flex items-center justify-center w-full h-full">✓</span>
          </button>

          <TaskCard
            :task="task"
            @snooze="(id, date) => $emit('snooze', id, date)"
            @someday="(id) => $emit('someday', id)"
            @activate="() => {}"
            @delete="(id) => $emit('delete', id)"
            @update="(id, patch) => $emit('update', id, patch)"
          />
        </div>
      </div>
    </section>
  </div>
</template>
