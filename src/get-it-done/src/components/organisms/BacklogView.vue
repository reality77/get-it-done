<script setup lang="ts">
import type { TrackedItemRef, ChecklistItemId, TaskPriority, TaskEffort, SwipeActionDef } from '../../types'
import { makeStatusActions, refToId } from '../../composables/useTaskActions'
import TaskCard from '../molecules/TaskCard.vue'
import MobilePlanningSheet from '../molecules/MobilePlanningSheet.vue'

defineProps<{
  snoozedItems: TrackedItemRef[]
  somedayItems: TrackedItemRef[]
}>()

const emit = defineEmits<{
  (e: 'activate', id: ChecklistItemId): void
  (e: 'snooze', id: ChecklistItemId, date: string): void
  (e: 'someday', id: ChecklistItemId): void
  (e: 'delete', id: ChecklistItemId): void
  (e: 'update-text', id: ChecklistItemId, text: string): void
  (e: 'update-priority', id: ChecklistItemId, priority: TaskPriority): void
  (e: 'update-effort', id: ChecklistItemId, effort: TaskEffort): void
}>()

function backlogActions(taskRef: TrackedItemRef) {
  return makeStatusActions(taskRef, {
    onActivate: (id) => emit('activate', id),
    onSnooze: (id, date) => emit('snooze', id, date),
    onSomeday: (id) => emit('someday', id),
    onDelete: (id) => emit('delete', id),
  })
}

function nextMonday(): string {
  const d = new Date()
  d.setDate(d.getDate() + (1 + 7 - d.getDay()) % 7 || 7)
  return d.toISOString().slice(0, 10)
}

function swipeLeft(taskRef: TrackedItemRef): SwipeActionDef {
  return {
    hint: 'Add to week',
    bgClass: 'bg-green-700',
    onTrigger: () => emit('snooze', refToId(taskRef), nextMonday()),
  }
}

function somedaySwipeRight(taskRef: TrackedItemRef): SwipeActionDef {
  return {
    hint: '↩ Activate',
    bgClass: 'bg-violet-700',
    onTrigger: () => emit('activate', refToId(taskRef)),
  }
}

function somedaySwipeLeft(taskRef: TrackedItemRef): SwipeActionDef {
  return {
    hint: 'Add to week',
    bgClass: 'bg-green-700',
    onTrigger: () => emit('snooze', refToId(taskRef), nextMonday()),
  }
}

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
          :show-checkbox="false"
          :swipe-left="swipeLeft(ref)"
          :actions="backlogActions(ref)"
          @update-text="(id, text) => $emit('update-text', id, text)"
        >
          <template #mobile-sheet="{ close }">
            <MobilePlanningSheet
              :item="ref.item"
              :item-id="{ checklistId: ref.checklistId, itemId: ref.item.id }"
              :close="close"
              @activate="(id) => $emit('activate', id)"
              @snooze="(id, date) => $emit('snooze', id, date)"
              @someday="(id) => $emit('someday', id)"
              @update-priority="(id, p) => $emit('update-priority', id, p)"
              @update-effort="(id, e) => $emit('update-effort', id, e)"
            />
          </template>
        </TaskCard>
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
          :show-checkbox="false"
          :swipe-right="somedaySwipeRight(ref)"
          :swipe-left="somedaySwipeLeft(ref)"
          :actions="backlogActions(ref)"
          @update-text="(id, text) => $emit('update-text', id, text)"
        >
          <template #mobile-sheet="{ close }">
            <MobilePlanningSheet
              :item="ref.item"
              :item-id="{ checklistId: ref.checklistId, itemId: ref.item.id }"
              :close="close"
              @activate="(id) => $emit('activate', id)"
              @snooze="(id, date) => $emit('snooze', id, date)"
              @someday="(id) => $emit('someday', id)"
              @update-priority="(id, p) => $emit('update-priority', id, p)"
              @update-effort="(id, e) => $emit('update-effort', id, e)"
            />
          </template>
        </TaskCard>
      </div>
    </section>

  </div>
</template>
