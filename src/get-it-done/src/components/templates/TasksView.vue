<script setup lang="ts">
import type { TrackedItemRef, TaskView } from '../../types'
import WeeklyReviewPanel from '../organisms/WeeklyReviewPanel.vue'
import DayView from '../organisms/DayView.vue'
import WeekView from '../organisms/WeekView.vue'
import BacklogView from '../organisms/BacklogView.vue'

defineProps<{
  weeklyReviewDue: boolean
  reviewDismissed: boolean
  snoozedItems: TrackedItemRef[]
  somedayItems: TrackedItemRef[]
  staleSnoozedIds: string[]
  dayItems: TrackedItemRef[]
  itemsByPriority: {
    urgent: TrackedItemRef[]
    important: TrackedItemRef[]
    secondary: TrackedItemRef[]
  }
  dismissedKeys: Set<string>
  currentView: TaskView
}>()

const emit = defineEmits<{
  (e: 'change-view', view: TaskView): void
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
        <button
          class="px-3 py-1 rounded text-sm font-medium transition-colors cursor-pointer"
          :class="currentView === 'backlog'
            ? 'bg-zinc-700 text-zinc-100'
            : 'text-zinc-400 hover:text-zinc-200'"
          @click="$emit('change-view', 'backlog')"
        >
          Backlog
        </button>
      </div>
    </div>

    <!-- Day view -->
    <DayView
      v-if="currentView === 'day'"
      :items="dayItems"
    />

    <!-- Week view -->
    <WeekView
      v-else-if="currentView === 'week'"
      :items-by-priority="itemsByPriority"
      :dismissed-keys="dismissedKeys"
    />

    <!-- Backlog view -->
    <BacklogView
      v-else-if="currentView === 'backlog'"
      :snoozed-items="snoozedItems"
      :someday-items="somedayItems"
    />
  </div>
</template>
