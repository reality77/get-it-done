<script setup lang="ts">
import type { TrackedItemRef, ChecklistItemId, ButtonActionDef } from '../../types'
import TaskCard from '../molecules/TaskCard.vue'
import AppButton from '../atoms/AppButton.vue'

const props = defineProps<{
  snoozedItems: TrackedItemRef[]
  somedayItems: TrackedItemRef[]
  staleSnoozedIds: string[]
}>()

const emit = defineEmits<{
  (e: 'activate', id: ChecklistItemId): void
  (e: 'snooze', id: ChecklistItemId, date: string): void
  (e: 'delete', id: ChecklistItemId): void
  (e: 'complete-review'): void
  (e: 'dismiss'): void
}>()

function reviewActions(ref: TrackedItemRef): ButtonActionDef[] {
  const id: ChecklistItemId = { checklistId: ref.checklistId, itemId: ref.item.id }
  const status = ref.item.status ?? 'active'
  const actions: ButtonActionDef[] = []
  if (status !== 'active') {
    actions.push({ label: '↩', title: 'Activate', variant: 'icon', onClick: () => emit('activate', id) })
  }
  if (status === 'active') {
    actions.push({ label: '💤', title: 'Snooze', variant: 'icon', snooze: (date) => emit('snooze', id, date) })
  }
  actions.push({ label: '✕', title: 'Delete', variant: 'danger', onClick: () => emit('delete', id) })
  return actions
}

function staleDays(ref: TrackedItemRef): number {
  if (!ref.item.snoozedAt) return 0
  const diff = Date.now() - new Date(ref.item.snoozedAt).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
</script>

<template>
  <div class="bg-zinc-900 border border-violet-800/40 rounded-xl p-4 mb-6">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-sm font-semibold text-zinc-100">Weekly Review</h3>
        <p class="text-xs text-zinc-500 mt-0.5">Triage your snoozed and someday items</p>
      </div>
      <AppButton variant="ghost" class="text-xs" @click="$emit('dismiss')">Dismiss</AppButton>
    </div>

    <!-- Snoozed items -->
    <div v-if="snoozedItems.length > 0" class="mb-4">
      <p class="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">Snoozed</p>
      <div class="space-y-1">
        <div v-for="ref in snoozedItems" :key="ref.item.id" class="relative">
          <div v-if="staleSnoozedIds.includes(ref.item.id)" class="flex items-center gap-1 mb-0.5">
            <span class="text-yellow-500 text-xs">⚠</span>
            <span class="text-xs text-yellow-600">Snoozed {{ staleDays(ref) }} days</span>
          </div>
          <TaskCard
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
    </div>

    <!-- Someday items -->
    <div v-if="somedayItems.length > 0" class="mb-4">
      <p class="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">Someday</p>
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
      class="text-sm text-zinc-500 mb-4"
    >
      No snoozed or someday items to review.
    </div>

    <AppButton variant="primary" @click="$emit('complete-review')">
      Mark review complete
    </AppButton>
  </div>
</template>
