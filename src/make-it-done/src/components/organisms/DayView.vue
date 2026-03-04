<script setup lang="ts">
import type { Task } from '../../types'
import DayPlanBar from '../molecules/DayPlanBar.vue'
import TaskCard from '../molecules/TaskCard.vue'

defineProps<{
  tasks: Task[]
  allActiveTasks: Task[]
}>()

defineEmits<{
  (e: 'suggest'): void
  (e: 'toggle-task', taskId: string): void
  (e: 'snooze', taskId: string, date: string): void
  (e: 'someday', taskId: string): void
  (e: 'delete', taskId: string): void
  (e: 'update', taskId: string, patch: Partial<Pick<Task, 'title' | 'priority' | 'effort'>>): void
}>()
</script>

<template>
  <div>
    <DayPlanBar
      :selected-count="tasks.length"
      @suggest="$emit('suggest')"
      @clear="$emit('suggest')"
    />

    <div v-if="tasks.length === 0" class="text-center py-12">
      <p class="text-zinc-500 text-sm mb-2">No tasks planned for today</p>
      <p class="text-zinc-600 text-xs">
        Click <strong class="text-zinc-500">Suggest</strong> to auto-pick tasks,
        or go to the <strong class="text-zinc-500">Week</strong> view to select manually.
      </p>
    </div>

    <div v-else class="space-y-1">
      <TaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :compact="true"
        @snooze="(id, date) => $emit('snooze', id, date)"
        @someday="(id) => $emit('someday', id)"
        @activate="(id) => $emit('toggle-task', id)"
        @delete="(id) => $emit('delete', id)"
        @update="(id, patch) => $emit('update', id, patch)"
      />
    </div>
  </div>
</template>
