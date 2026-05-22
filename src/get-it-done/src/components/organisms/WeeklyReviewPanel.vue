<script setup lang="ts">
import type { TrackedItemRef } from '../../types'
import { makeStatusActions } from '../../composables/useTaskActions'
import { useChecklistStore } from '../../stores/checklists'
import TaskCard from '../molecules/TaskCard.vue'
import VButton from '../atoms/VButton.vue'

const props = defineProps<{
  snoozedItems: TrackedItemRef[]
  somedayItems: TrackedItemRef[]
  staleSnoozedIds: string[]
}>()

const emit = defineEmits<{
  (e: 'complete-review'): void
  (e: 'dismiss'): void
}>()

const store = useChecklistStore()

function reviewActions(taskRef: TrackedItemRef) {
  return makeStatusActions(taskRef, {
    onActivate: (id) => store.activateItem(id),
    onSnooze: (id, date) => store.snoozeItem(id, date),
    onDelete: (id) => store.removeItem(id),
  })
}

function staleDays(ref: TrackedItemRef): number {
  if (!ref.item.snoozedAt) return 0
  const diff = Date.now() - new Date(ref.item.snoozedAt).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
</script>

<template>
  <div class="bg-bg-1 border border-primary/25 rounded-xl p-4 mb-6">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-sm font-semibold text-fg">Weekly Review</h3>
        <p class="text-xs text-fg-4 mt-0.5">Triage your snoozed and someday items</p>
      </div>
      <VButton variant="ghost" class="text-xs" @click="$emit('dismiss')">Dismiss</VButton>
    </div>

    <!-- Snoozed items -->
    <div v-if="snoozedItems.length > 0" class="mb-4">
      <p class="text-xs text-fg-4 mb-2 font-medium uppercase tracking-wide">Snoozed</p>
      <div class="space-y-1">
        <div v-for="ref in snoozedItems" :key="ref.item.id" class="relative">
          <div v-if="staleSnoozedIds.includes(ref.item.id)" class="flex items-center gap-1 mb-0.5">
            <span class="text-warning text-xs">⚠</span>
            <span class="text-xs text-warning">Snoozed {{ staleDays(ref) }} days</span>
          </div>
          <TaskCard
            :item="ref.item"
            :checklist-id="ref.checklistId"
            :checklist-title="ref.checklistTitle"
            :compact="true"
            :actions="reviewActions(ref)"
          />
        </div>
      </div>
    </div>

    <!-- Someday items -->
    <div v-if="somedayItems.length > 0" class="mb-4">
      <p class="text-xs text-fg-4 mb-2 font-medium uppercase tracking-wide">Someday</p>
      <div class="space-y-1">
        <TaskCard
          v-for="ref in somedayItems"
          :key="ref.item.id"
          :item="ref.item"
          :checklist-id="ref.checklistId"
          :checklist-title="ref.checklistTitle"
          :compact="true"
          :actions="reviewActions(ref)"
          @update-text="() => {}"
          @toggle-done="() => {}"
        />
      </div>
    </div>

    <div
      v-if="snoozedItems.length === 0 && somedayItems.length === 0"
      class="text-sm text-fg-4 mb-4"
    >
      No snoozed or someday items to review.
    </div>

    <VButton variant="primary" @click="$emit('complete-review')">
      Mark review complete
    </VButton>
  </div>
</template>
