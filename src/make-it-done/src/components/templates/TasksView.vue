<script setup lang="ts">
import type { Task, TaskPriority, TaskView } from '../../types'
import WeeklyReviewPanel from '../organisms/WeeklyReviewPanel.vue'
import DayView from '../organisms/DayView.vue'
import WeekView from '../organisms/WeekView.vue'
import AppButton from '../atoms/AppButton.vue'

defineProps<{
  weeklyReviewDue: boolean
  reviewDismissed: boolean
  snoozedTasks: Task[]
  somedayTasks: Task[]
  staleSnoozedIds: string[]
  dayTasks: Task[]
  allActiveTasks: Task[]
  tasksByPriority: {
    urgent: Task[]
    important: Task[]
    secondary: Task[]
  }
  currentView: TaskView
}>()

const emit = defineEmits<{
  (e: 'change-view', view: TaskView): void
  (e: 'create-task', priority?: TaskPriority): void
  (e: 'activate', taskId: string): void
  (e: 'snooze', taskId: string, date: string): void
  (e: 'someday', taskId: string): void
  (e: 'delete', taskId: string): void
  (e: 'update', taskId: string, patch: Partial<Pick<Task, 'title' | 'priority' | 'effort'>>): void
  (e: 'suggest-day'): void
  (e: 'toggle-day', taskId: string): void
  (e: 'complete-review'): void
  (e: 'dismiss-review'): void
}>()
</script>

<template>
  <div class="relative">
    <!-- Weekly review panel -->
    <WeeklyReviewPanel
      v-if="weeklyReviewDue && !reviewDismissed"
      :snoozed-tasks="snoozedTasks"
      :someday-tasks="somedayTasks"
      :stale-snoozed-ids="staleSnoozedIds"
      @activate="(id) => $emit('activate', id)"
      @snooze="(id, date) => $emit('snooze', id, date)"
      @delete="(id) => $emit('delete', id)"
      @complete-review="$emit('complete-review')"
      @dismiss="$emit('dismiss-review')"
    />

    <!-- View switcher -->
    <div class="flex items-center gap-2 mb-5">
      <div class="flex bg-zinc-800 rounded-lg p-1 gap-1">
        <button
          class="px-3 py-1 rounded text-sm font-medium transition-colors cursor-pointer"
          :class="currentView === 'day'
            ? 'bg-zinc-700 text-zinc-100'
            : 'text-zinc-400 hover:text-zinc-200'"
          @click="$emit('change-view', 'day')"
        >
          Day
        </button>
        <button
          class="px-3 py-1 rounded text-sm font-medium transition-colors cursor-pointer"
          :class="currentView === 'week'
            ? 'bg-zinc-700 text-zinc-100'
            : 'text-zinc-400 hover:text-zinc-200'"
          @click="$emit('change-view', 'week')"
        >
          Week
        </button>
      </div>

      <!-- New task button -->
      <AppButton variant="primary" class="ml-auto" @click="$emit('create-task')">
        + New task
      </AppButton>
    </div>

    <!-- Day view -->
    <DayView
      v-if="currentView === 'day'"
      :tasks="dayTasks"
      :all-active-tasks="allActiveTasks"
      @suggest="$emit('suggest-day')"
      @toggle-task="(id) => $emit('toggle-day', id)"
      @snooze="(id, date) => $emit('snooze', id, date)"
      @someday="(id) => $emit('someday', id)"
      @delete="(id) => $emit('delete', id)"
      @update="(id, patch) => $emit('update', id, patch)"
    />

    <!-- Week view -->
    <WeekView
      v-else
      :tasks-by-priority="tasksByPriority"
      @snooze="(id, date) => $emit('snooze', id, date)"
      @someday="(id) => $emit('someday', id)"
      @delete="(id) => $emit('delete', id)"
      @update="(id, patch) => $emit('update', id, patch)"
      @toggle-day="(id) => $emit('toggle-day', id)"
      @create="(priority) => $emit('create-task', priority)"
    />
  </div>
</template>
