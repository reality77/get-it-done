<script setup lang="ts">
import type { TrackedItemRef, ChecklistItemId, TaskPriority, TaskEffort } from '../../types'
import TaskCard from '../molecules/TaskCard.vue'

defineProps<{
  snoozedItems: TrackedItemRef[]
  somedayItems: TrackedItemRef[]
}>()

defineEmits<{
  (e: 'activate', id: ChecklistItemId): void
  (e: 'snooze', id: ChecklistItemId, date: string): void
  (e: 'someday', id: ChecklistItemId): void
  (e: 'delete', id: ChecklistItemId): void
  (e: 'update-text', id: ChecklistItemId, text: string): void
  (e: 'update-priority', id: ChecklistItemId, priority: TaskPriority): void
  (e: 'update-effort', id: ChecklistItemId, effort: TaskEffort): void
}>()
</script>

<template>
  <div class="space-y-6">

    <!-- Snoozed -->
    <section>
      <h3 class="text-sm font-semibold text-zinc-400 mb-2 flex items-center gap-2">
        <span>💤 Snoozed</span>
        <span class="text-zinc-600 font-normal">({{ snoozedItems.length }})</span>
      </h3>
      <div v-if="snoozedItems.length === 0" class="text-xs text-zinc-600 py-2 pl-4">No snoozed tasks.</div>
      <div v-else class="space-y-0.5">
        <TaskCard
          v-for="ref in snoozedItems"
          :key="ref.item.id"
          :item="ref.item"
          :checklist-id="ref.checklistId"
          :checklist-title="ref.checklistTitle"
          :planning-mode="true"
          @activate="(id) => $emit('activate', id)"
          @snooze="(id, date) => $emit('snooze', id, date)"
          @someday="(id) => $emit('someday', id)"
          @delete="(id) => $emit('delete', id)"
          @update-text="(id, text) => $emit('update-text', id, text)"
          @update-priority="(id, p) => $emit('update-priority', id, p)"
          @update-effort="(id, e) => $emit('update-effort', id, e)"
        />
      </div>
    </section>

    <!-- Someday -->
    <section>
      <h3 class="text-sm font-semibold text-zinc-400 mb-2 flex items-center gap-2">
        <span>☁ Someday</span>
        <span class="text-zinc-600 font-normal">({{ somedayItems.length }})</span>
      </h3>
      <div v-if="somedayItems.length === 0" class="text-xs text-zinc-600 py-2 pl-4">No someday tasks.</div>
      <div v-else class="space-y-0.5">
        <TaskCard
          v-for="ref in somedayItems"
          :key="ref.item.id"
          :item="ref.item"
          :checklist-id="ref.checklistId"
          :checklist-title="ref.checklistTitle"
          :planning-mode="true"
          @activate="(id) => $emit('activate', id)"
          @snooze="(id, date) => $emit('snooze', id, date)"
          @someday="(id) => $emit('someday', id)"
          @delete="(id) => $emit('delete', id)"
          @update-text="(id, text) => $emit('update-text', id, text)"
          @update-priority="(id, p) => $emit('update-priority', id, p)"
          @update-effort="(id, e) => $emit('update-effort', id, e)"
        />
      </div>
    </section>

  </div>
</template>
