<script setup lang="ts">
import type { TrackedItemRef, ChecklistItemId } from '../../types'
import DayPlanBar from '../molecules/DayPlanBar.vue'
import TaskCard from '../molecules/TaskCard.vue'

defineProps<{
  items: TrackedItemRef[]
  allActiveItems: TrackedItemRef[]
}>()

defineEmits<{
  (e: 'suggest'): void
  (e: 'toggle-done', id: ChecklistItemId): void
  (e: 'snooze', id: ChecklistItemId, date: string): void
  (e: 'someday', id: ChecklistItemId): void
  (e: 'delete', id: ChecklistItemId): void
  (e: 'update-text', id: ChecklistItemId, text: string): void
}>()
</script>

<template>
  <div>
    <DayPlanBar
      :selected-count="items.length"
      @suggest="$emit('suggest')"
      @clear="$emit('suggest')"
    />

    <div v-if="items.length === 0" class="text-center py-12">
      <p class="text-zinc-500 text-sm mb-2">No tasks planned for today</p>
      <p class="text-zinc-600 text-xs">
        Click <strong class="text-zinc-500">Suggest</strong> to auto-pick tasks,
        or go to the <strong class="text-zinc-500">Week</strong> view to select manually.
      </p>
    </div>

    <div v-else class="space-y-1">
      <TaskCard
        v-for="ref in items"
        :key="ref.item.id"
        :item="ref.item"
        :checklist-id="ref.checklistId"
        :checklist-title="ref.checklistTitle"
        :compact="true"
        @toggle-done="(id) => $emit('toggle-done', id)"
        @snooze="(id, date) => $emit('snooze', id, date)"
        @someday="(id) => $emit('someday', id)"
        @activate="() => {}"
        @delete="(id) => $emit('delete', id)"
        @update-text="(id, text) => $emit('update-text', id, text)"
      />
    </div>
  </div>
</template>
