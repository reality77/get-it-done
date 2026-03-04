<script setup lang="ts">
import type { TrackedItemRef } from '../../types'
import DayPlanBar from '../molecules/DayPlanBar.vue'
import TaskCard from '../molecules/TaskCard.vue'

defineProps<{
  items: TrackedItemRef[]
  allActiveItems: TrackedItemRef[]
}>()

defineEmits<{
  (e: 'suggest'): void
  (e: 'toggle-done', checklistId: string, itemId: string): void
  (e: 'snooze', checklistId: string, itemId: string, date: string): void
  (e: 'someday', checklistId: string, itemId: string): void
  (e: 'delete', checklistId: string, itemId: string): void
  (e: 'update-text', checklistId: string, itemId: string, text: string): void
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
        @toggle-done="(cId, iId) => $emit('toggle-done', cId, iId)"
        @snooze="(cId, iId, date) => $emit('snooze', cId, iId, date)"
        @someday="(cId, iId) => $emit('someday', cId, iId)"
        @activate="() => {}"
        @delete="(cId, iId) => $emit('delete', cId, iId)"
        @update-text="(cId, iId, text) => $emit('update-text', cId, iId, text)"
      />
    </div>
  </div>
</template>
