<script setup lang="ts">
import { ref } from 'vue'
import type { TrackedItemRef, SwipeActionDef } from '../../types'
import { makeStatusActions, refToId } from '../../composables/useTaskActions'
import { useChecklistStore } from '../../stores/checklists'
import TaskCard from '../molecules/TaskCard.vue'
import MobilePlanningSheet from '../molecules/MobilePlanningSheet.vue'
import SnoozeModal from '../molecules/SnoozeModal.vue'

defineProps<{
  snoozedItems: TrackedItemRef[]
  somedayItems: TrackedItemRef[]
}>()

const store = useChecklistStore()

const pendingSnoozeTask = ref<TrackedItemRef | null>(null)

function openSnoozeModal(taskRef: TrackedItemRef): void {
  pendingSnoozeTask.value = taskRef
}

function onSnoozePick(date: string): void {
  if (pendingSnoozeTask.value) {
    store.snoozeItem(refToId(pendingSnoozeTask.value), date)
    pendingSnoozeTask.value = null
  }
}

function onSnoozeCancel(): void {
  pendingSnoozeTask.value = null
}

function backlogActions(taskRef: TrackedItemRef) {
  const actions = makeStatusActions(taskRef, {
    onActivate: (id) => store.activateItem(id),
    onSnooze: (id, date) => store.snoozeItem(id, date),
    onSomeday: (id) => store.sendItemToSomeday(id),
    onDelete: (id) => store.removeItem(id),
  })
  if (taskRef.isChecklistTask) return actions.filter(a => a.label !== 'Delete')
  return actions
}

function addToWeek(taskRef: TrackedItemRef): void {
  const id = refToId(taskRef)
  store.activateItem(id)
  store.toggleItemWeekPlan(id)
}

function snoozedSwipeRight(taskRef: TrackedItemRef): SwipeActionDef {
  return { hint: 'Add to week', bgClass: 'bg-success', onTrigger: () => addToWeek(taskRef) }
}

function snoozedSwipeLeft(taskRef: TrackedItemRef): SwipeActionDef {
  return { hint: '💤 Snooze', bgClass: 'bg-warning', onTrigger: () => openSnoozeModal(taskRef) }
}

function somedaySwipeRight(taskRef: TrackedItemRef): SwipeActionDef {
  return { hint: 'Add to week', bgClass: 'bg-success', onTrigger: () => addToWeek(taskRef) }
}

function somedaySwipeLeft(taskRef: TrackedItemRef): SwipeActionDef {
  return { hint: '💤 Snooze', bgClass: 'bg-warning', onTrigger: () => openSnoozeModal(taskRef) }
}

function formatSnoozeDate(raw: string): string {
  return new Date(raw).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
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
      <div v-else class="space-y-3">
        <div
          v-for="ref in snoozedItems"
          :key="ref.item.id"
          class="relative overflow-hidden rounded-xl"
        >
          <!-- Snooze date ribbon -->
          <div
            v-if="ref.item.snoozeUntil"
            class="absolute top-0 right-0 z-10 pointer-events-none pl-5 pr-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-white bg-sky-500 rounded-bl-xl"
            style="clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 35% 100%)"
          >💤 {{ formatSnoozeDate(ref.item.snoozeUntil) }}</div>

          <TaskCard
            :item="ref.item"
            :checklist-id="ref.checklistId"
            :checklist-title="ref.checklistTitle"
            :show-checklist-title="true"
            :show-checkbox="false"
            :swipe-left="snoozedSwipeLeft(ref)"
            :swipe-right="snoozedSwipeRight(ref)"
            :actions="backlogActions(ref)"
            :is-checklist-task="ref.isChecklistTask"
            :progress="ref.progress"
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
      </div>
    </section>

    <!-- Someday -->
    <section>
      <h3 class="text-sm font-semibold text-fg-3 mb-2 flex items-center gap-2">
        <span>☁ Someday</span>
        <span class="text-fg-4 font-normal">({{ somedayItems.length }})</span>
      </h3>
      <div v-if="somedayItems.length === 0" class="text-xs text-fg-4 py-2 pl-4">No someday tasks.</div>
      <div v-else class="space-y-3">
        <TaskCard
          v-for="ref in somedayItems"
          :key="ref.item.id"
          :item="ref.item"
          :checklist-id="ref.checklistId"
          :checklist-title="ref.checklistTitle"
          :show-checklist-title="true"
          :show-checkbox="false"
          :swipe-left="somedaySwipeLeft(ref)"
          :swipe-right="somedaySwipeRight(ref)"
          :actions="backlogActions(ref)"
          :is-checklist-task="ref.isChecklistTask"
          :progress="ref.progress"
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

  <SnoozeModal
    v-if="pendingSnoozeTask"
    :deadline="pendingSnoozeTask.item.deadline"
    @pick="onSnoozePick"
    @cancel="onSnoozeCancel"
  />
</template>
