<script setup lang="ts">
import type { TrackedItemRef, TaskPriority, TaskEffort, TaskView, ChecklistItemId } from '../../types'
import WeeklyReviewPanel from '../organisms/WeeklyReviewPanel.vue'
import DayView from '../organisms/DayView.vue'
import WeekView from '../organisms/WeekView.vue'

defineProps<{
  weeklyReviewDue: boolean
  reviewDismissed: boolean
  snoozedItems: TrackedItemRef[]
  somedayItems: TrackedItemRef[]
  staleSnoozedIds: string[]
  dayItems: TrackedItemRef[]
  allActiveItems: TrackedItemRef[]
  itemsByPriority: {
    urgent: TrackedItemRef[]
    important: TrackedItemRef[]
    secondary: TrackedItemRef[]
  }
  currentView: TaskView
}>()

const emit = defineEmits<{
  (e: 'change-view', view: TaskView): void
  (e: 'activate', id: ChecklistItemId): void
  (e: 'snooze', id: ChecklistItemId, date: string): void
  (e: 'someday', id: ChecklistItemId): void
  (e: 'delete', id: ChecklistItemId): void
  (e: 'update-priority', id: ChecklistItemId, priority: TaskPriority): void
  (e: 'update-effort', id: ChecklistItemId, effort: TaskEffort): void
  (e: 'update-text', id: ChecklistItemId, text: string): void
  (e: 'toggle-done', id: ChecklistItemId): void
  (e: 'suggest-day'): void
  (e: 'toggle-day', id: ChecklistItemId): void
  (e: 'complete-review'): void
  (e: 'dismiss-review'): void
  (e: 'clear'): void
}>()
</script>

<template>
  <div class="relative">
    <!-- Weekly review panel -->
    <WeeklyReviewPanel
      v-if="weeklyReviewDue && !reviewDismissed"
      :snoozed-items="snoozedItems"
      :someday-items="somedayItems"
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
    </div>

    <!-- Day view -->
    <DayView
      v-if="currentView === 'day'"
      :items="dayItems"
      :all-active-items="allActiveItems"
      @suggest="$emit('suggest-day')"
      @toggle-done="(id) => $emit('toggle-done', id)"
      @snooze="(id, date) => $emit('snooze', id, date)"
      @someday="(id) => $emit('someday', id)"
      @delete="(id) => $emit('delete', id)"
      @update-text="(id, text) => $emit('update-text', id, text)"
      @clear="$emit('clear')"
    />

    <!-- Week view -->
    <WeekView
      v-else
      :items-by-priority="itemsByPriority"
      @snooze="(id, date) => $emit('snooze', id, date)"
      @someday="(id) => $emit('someday', id)"
      @delete="(id) => $emit('delete', id)"
      @update-priority="(id, p) => $emit('update-priority', id, p)"
      @update-effort="(id, e) => $emit('update-effort', id, e)"
      @update-text="(id, text) => $emit('update-text', id, text)"
      @toggle-day="(id) => $emit('toggle-day', id)"
      @toggle-done="(id) => $emit('toggle-done', id)"
    />
  </div>
</template>
