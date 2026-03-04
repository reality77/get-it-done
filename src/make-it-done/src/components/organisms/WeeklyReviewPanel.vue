<script setup lang="ts">
import type { Task } from '../../types'
import TaskCard from '../molecules/TaskCard.vue'
import AppButton from '../atoms/AppButton.vue'

const props = defineProps<{
  snoozedTasks: Task[]
  somedayTasks: Task[]
  staleSnoozedIds: string[]
}>()

const emit = defineEmits<{
  (e: 'activate', taskId: string): void
  (e: 'snooze', taskId: string, date: string): void
  (e: 'delete', taskId: string): void
  (e: 'complete-review'): void
  (e: 'dismiss'): void
}>()

function staleDays(task: Task): number {
  if (!task.snoozedAt) return 0
  const diff = Date.now() - new Date(task.snoozedAt).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
</script>

<template>
  <div class="bg-zinc-900 border border-violet-800/40 rounded-xl p-4 mb-6">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-sm font-semibold text-zinc-100">Weekly Review</h3>
        <p class="text-xs text-zinc-500 mt-0.5">Triage your snoozed and someday tasks</p>
      </div>
      <AppButton variant="ghost" class="text-xs" @click="$emit('dismiss')">Dismiss</AppButton>
    </div>

    <!-- Snoozed tasks -->
    <div v-if="snoozedTasks.length > 0" class="mb-4">
      <p class="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">Snoozed</p>
      <div class="space-y-1">
        <div v-for="task in snoozedTasks" :key="task.id" class="relative">
          <div v-if="staleSnoozedIds.includes(task.id)" class="flex items-center gap-1 mb-0.5">
            <span class="text-yellow-500 text-xs">⚠</span>
            <span class="text-xs text-yellow-600">Snoozed {{ staleDays(task) }} days</span>
          </div>
          <TaskCard
            :task="task"
            :compact="true"
            @activate="(id) => $emit('activate', id)"
            @snooze="(id, date) => $emit('snooze', id, date)"
            @someday="() => {}"
            @delete="(id) => $emit('delete', id)"
            @update="() => {}"
          />
        </div>
      </div>
    </div>

    <!-- Someday tasks -->
    <div v-if="somedayTasks.length > 0" class="mb-4">
      <p class="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">Someday</p>
      <div class="space-y-1">
        <TaskCard
          v-for="task in somedayTasks"
          :key="task.id"
          :task="task"
          :compact="true"
          @activate="(id) => $emit('activate', id)"
          @snooze="(id, date) => $emit('snooze', id, date)"
          @someday="() => {}"
          @delete="(id) => $emit('delete', id)"
          @update="() => {}"
        />
      </div>
    </div>

    <div
      v-if="snoozedTasks.length === 0 && somedayTasks.length === 0"
      class="text-sm text-zinc-500 mb-4"
    >
      No snoozed or someday tasks to review.
    </div>

    <AppButton variant="primary" @click="$emit('complete-review')">
      Mark review complete
    </AppButton>
  </div>
</template>
