<script setup lang="ts">
import type { TrackedItemRef, TaskPriority, TaskEffort, TaskView } from '../../types'
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
  (e: 'activate', checklistId: string, itemId: string): void
  (e: 'snooze', checklistId: string, itemId: string, date: string): void
  (e: 'someday', checklistId: string, itemId: string): void
  (e: 'delete', checklistId: string, itemId: string): void
  (e: 'update-priority', checklistId: string, itemId: string, priority: TaskPriority): void
  (e: 'update-effort', checklistId: string, itemId: string, effort: TaskEffort): void
  (e: 'update-text', checklistId: string, itemId: string, text: string): void
  (e: 'toggle-done', checklistId: string, itemId: string): void
  (e: 'suggest-day'): void
  (e: 'toggle-day', checklistId: string, itemId: string): void
  (e: 'complete-review'): void
  (e: 'dismiss-review'): void
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
      @activate="(cId, iId) => $emit('activate', cId, iId)"
      @snooze="(cId, iId, date) => $emit('snooze', cId, iId, date)"
      @delete="(cId, iId) => $emit('delete', cId, iId)"
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
      @toggle-done="(cId, iId) => $emit('toggle-done', cId, iId)"
      @snooze="(cId, iId, date) => $emit('snooze', cId, iId, date)"
      @someday="(cId, iId) => $emit('someday', cId, iId)"
      @delete="(cId, iId) => $emit('delete', cId, iId)"
      @update-text="(cId, iId, text) => $emit('update-text', cId, iId, text)"
    />

    <!-- Week view -->
    <WeekView
      v-else
      :items-by-priority="itemsByPriority"
      @snooze="(cId, iId, date) => $emit('snooze', cId, iId, date)"
      @someday="(cId, iId) => $emit('someday', cId, iId)"
      @delete="(cId, iId) => $emit('delete', cId, iId)"
      @update-priority="(cId, iId, p) => $emit('update-priority', cId, iId, p)"
      @update-effort="(cId, iId, e) => $emit('update-effort', cId, iId, e)"
      @update-text="(cId, iId, text) => $emit('update-text', cId, iId, text)"
      @toggle-day="(cId, iId) => $emit('toggle-day', cId, iId)"
      @toggle-done="(cId, iId) => $emit('toggle-done', cId, iId)"
    />
  </div>
</template>
