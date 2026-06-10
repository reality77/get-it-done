<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TrackedItemRef, SwipeActionDef } from '../../types'
import { makeStatusActions, refToId } from '../../composables/useTaskActions'
import { parseLocalDate } from '../../composables/useTreeHelpers'
import { useChecklistStore } from '../../stores/checklists'
import TaskCard from '../molecules/TaskCard.vue'
import MobilePlanningSheet from '../molecules/MobilePlanningSheet.vue'
import SnoozeModal from '../molecules/SnoozeModal.vue'
import ChecklistCompletionModal from '../molecules/ChecklistCompletionModal.vue'

type BacklogFilter = 'all' | 'next-week' | 'in-2-weeks' | 'later' | 'someday'

const filters: { key: BacklogFilter; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'next-week',  label: 'Next week' },
  { key: 'in-2-weeks', label: 'In 2 weeks' },
  { key: 'later',      label: 'Later' },
  { key: 'someday',    label: 'Someday' },
]

const props = defineProps<{
  snoozedItems: TrackedItemRef[]
  somedayItems: TrackedItemRef[]
}>()

const activeFilter = ref<BacklogFilter>('all')

function getWeekBoundaries() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay() // 0=Sun
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  const nextMonday     = new Date(thisMonday); nextMonday.setDate(thisMonday.getDate() + 7)
  const twoWeeksMonday = new Date(thisMonday); twoWeeksMonday.setDate(thisMonday.getDate() + 14)
  const laterMonday    = new Date(thisMonday); laterMonday.setDate(thisMonday.getDate() + 21)
  return { nextMonday, twoWeeksMonday, laterMonday }
}

const filteredSnoozedItems = computed<TrackedItemRef[]>(() => {
  if (activeFilter.value === 'someday') return []
  if (activeFilter.value === 'all') return props.snoozedItems
  const { nextMonday, twoWeeksMonday, laterMonday } = getWeekBoundaries()
  return props.snoozedItems.filter(r => {
    if (!r.item.snoozeUntil) return false
    const d = parseLocalDate(r.item.snoozeUntil)
    if (activeFilter.value === 'next-week')  return d >= nextMonday     && d < twoWeeksMonday
    if (activeFilter.value === 'in-2-weeks') return d >= twoWeeksMonday && d < laterMonday
    if (activeFilter.value === 'later')      return d >= laterMonday
    return false
  })
})

const filteredSomedayItems = computed<TrackedItemRef[]>(() => {
  if (activeFilter.value === 'all' || activeFilter.value === 'someday') return props.somedayItems
  return []
})

const store = useChecklistStore()

// ── Completion modal ──────────────────────────────────────────────────────────
const completionModalChecklistId = ref<string | null>(null)
const completionModalChecklist = computed(() =>
  completionModalChecklistId.value
    ? store.getChecklist(completionModalChecklistId.value) ?? null
    : null
)

function openCompletionModal(checklistId: string): void {
  completionModalChecklistId.value = checklistId
}

function onModalArchive(): void {
  if (completionModalChecklistId.value) store.archiveChecklist(completionModalChecklistId.value)
  completionModalChecklistId.value = null
}

function onModalClose(): void {
  completionModalChecklistId.value = null
}

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

function onSnoozeSomeday(): void {
  if (pendingSnoozeTask.value) {
    store.sendItemToSomeday(refToId(pendingSnoozeTask.value))
    pendingSnoozeTask.value = null
  }
}

function onSnoozeCancel(): void {
  pendingSnoozeTask.value = null
}

function backlogActions(taskRef: TrackedItemRef) {
  return makeStatusActions(taskRef, {
    onActivate: (id) => store.activateItem(id),
    onSnooze: (id, date) => store.snoozeItem(id, date),
    onSomeday: (id) => store.sendItemToSomeday(id),
    onDelete: taskRef.isChecklistTask ? null : (id) => store.removeItem(id),
  })
}

function addToWeek(taskRef: TrackedItemRef): void {
  const id = refToId(taskRef)
  store.activateItem(id)
}

function snoozedSwipeRight(taskRef: TrackedItemRef): SwipeActionDef {
  return { hint: '↩ Activate', bgClass: 'bg-success', onTrigger: () => addToWeek(taskRef) }
}

function snoozedSwipeLeft(taskRef: TrackedItemRef): SwipeActionDef {
  return { hint: '💤 Snooze', bgClass: 'bg-warning', onTrigger: () => openSnoozeModal(taskRef) }
}

function somedaySwipeRight(taskRef: TrackedItemRef): SwipeActionDef {
  return { hint: '↩ Activate', bgClass: 'bg-success', onTrigger: () => addToWeek(taskRef) }
}

function somedaySwipeLeft(taskRef: TrackedItemRef): SwipeActionDef {
  return { hint: '💤 Snooze', bgClass: 'bg-warning', onTrigger: () => openSnoozeModal(taskRef) }
}

function formatSnoozeDate(raw: string): string {
  return parseLocalDate(raw).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="flex flex-col h-full">

    <!-- Quick filter — sits above the scroll area, never scrolls -->
    <div class="shrink-0 pt-1 pb-3">
      <div class="flex gap-1.5 overflow-x-auto scrollbar-hide">
        <button
          v-for="f in filters"
          :key="f.key"
          class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
          :class="activeFilter === f.key
            ? 'bg-primary text-fg-on-primary'
            : 'bg-bg-2 text-fg-3 hover:text-fg-2 hover:bg-bg-3'"
          @click="activeFilter = f.key"
        >{{ f.label }}</button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto space-y-6 pb-20 md:pb-0">

    <!-- Snoozed -->
    <section v-if="activeFilter !== 'someday'">
      <h3 class="text-sm font-semibold text-fg-3 mb-2 flex items-center gap-2">
        <span>💤 Snoozed</span>
        <span class="text-fg-4 font-normal">({{ filteredSnoozedItems.length }})</span>
      </h3>
      <div v-if="filteredSnoozedItems.length === 0" class="text-xs text-fg-4 py-2 pl-4">No snoozed tasks.</div>
      <div v-else class="space-y-3">
        <div
          v-for="ref in filteredSnoozedItems"
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
                :is-checklist-task="ref.isChecklistTask"
                :on-complete="ref.isChecklistTask
                  ? () => openCompletionModal(ref.checklistId)
                  : undefined"
              />
            </template>
          </TaskCard>
        </div>
      </div>
    </section>

    <!-- Someday -->
    <section v-if="activeFilter === 'all' || activeFilter === 'someday'">
      <h3 class="text-sm font-semibold text-fg-3 mb-2 flex items-center gap-2">
        <span>☁ Someday</span>
        <span class="text-fg-4 font-normal">({{ filteredSomedayItems.length }})</span>
      </h3>
      <div v-if="filteredSomedayItems.length === 0" class="text-xs text-fg-4 py-2 pl-4">No someday tasks.</div>
      <div v-else class="space-y-3">
        <TaskCard
          v-for="ref in filteredSomedayItems"
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
              :is-checklist-task="ref.isChecklistTask"
              :on-complete="ref.isChecklistTask
                ? () => openCompletionModal(ref.checklistId)
                : undefined"
            />
          </template>
        </TaskCard>
      </div>
    </section>

    </div><!-- end scroll area -->
  </div>

  <SnoozeModal
    v-if="pendingSnoozeTask"
    :task-name="pendingSnoozeTask.item.text"
    :checklist-title="pendingSnoozeTask.checklistTitle"
    :deadline="pendingSnoozeTask.item.deadline"
    :snooze-until="pendingSnoozeTask.item.snoozeUntil"
    :status="pendingSnoozeTask.item.status"
    @pick="onSnoozePick"
    @someday="onSnoozeSomeday"
    @cancel="onSnoozeCancel"
  />

  <ChecklistCompletionModal
    v-if="completionModalChecklist"
    :checklist="completionModalChecklist"
    @archive="onModalArchive"
    @close="onModalClose"
  />
</template>
