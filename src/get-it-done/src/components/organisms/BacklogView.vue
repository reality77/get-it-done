<script setup lang="ts">
import type { TrackedItemRef, SwipeActionDef } from '../../types'
import { makeStatusActions, refToId } from '../../composables/useTaskActions'
import { useChecklistStore } from '../../stores/checklists'
import TaskCard from '../molecules/TaskCard.vue'
import MobilePlanningSheet from '../molecules/MobilePlanningSheet.vue'

defineProps<{
  snoozedItems: TrackedItemRef[]
  somedayItems: TrackedItemRef[]
}>()

const store = useChecklistStore()

function backlogActions(taskRef: TrackedItemRef) {
  return makeStatusActions(taskRef, {
    onActivate: (id) => store.activateItem(id),
    onSnooze: (id, date) => store.snoozeItem(id, date),
    onSomeday: (id) => store.sendItemToSomeday(id),
    onDelete: (id) => store.removeItem(id),
  })
}

function swipeLeft(taskRef: TrackedItemRef): SwipeActionDef {
  return {
    hint: 'Add to week',
    bgClass: 'bg-success',
    onTrigger: () => store.activateItem(refToId(taskRef)),
  }
}

function somedaySwipeRight(taskRef: TrackedItemRef): SwipeActionDef {
  return {
    hint: '↩ Activate',
    bgClass: 'bg-primary',
    onTrigger: () => store.activateItem(refToId(taskRef)),
  }
}

function somedaySwipeLeft(taskRef: TrackedItemRef): SwipeActionDef {
  return {
    hint: 'Add to week',
    bgClass: 'bg-success',
    onTrigger: () => store.activateItem(refToId(taskRef)),
  }
}

</script>

<template>
  <div class="space-y-6">

    <!-- Snoozed -->
    <section>
      <h3 class="text-sm font-semibold text-fg-3 mb-2 flex items-center gap-2">
        <span>💤 Snoozed</span>
        <span class="text-fg-4 font-normal">({{ snoozedItems.length }})</span>
      </h3>
      <div v-if="snoozedItems.length === 0" class="text-xs text-fg-4 py-2 pl-4">No snoozed tasks.</div>
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
        >
          <template #mobile-sheet="{ close }">
            <MobilePlanningSheet
              :item="ref.item"
              :item-id="{ checklistId: ref.checklistId, itemId: ref.item.id }"
              :close="close"
            />
          </template>
        </TaskCard>
      </div>
    </section>

    <!-- Someday -->
    <section>
      <h3 class="text-sm font-semibold text-fg-3 mb-2 flex items-center gap-2">
        <span>☁ Someday</span>
        <span class="text-fg-4 font-normal">({{ somedayItems.length }})</span>
      </h3>
      <div v-if="somedayItems.length === 0" class="text-xs text-fg-4 py-2 pl-4">No someday tasks.</div>
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
        >
          <template #mobile-sheet="{ close }">
            <MobilePlanningSheet
              :item="ref.item"
              :item-id="{ checklistId: ref.checklistId, itemId: ref.item.id }"
              :close="close"
            />
          </template>
        </TaskCard>
      </div>
    </section>

  </div>
</template>
