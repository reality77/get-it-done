<script setup lang="ts">
import { ref, computed } from "vue";
import type { TrackedItemRef, SwipeActionDef } from "../../types";
import { makeSnoozeSomedayDeleteActions, refToId } from "../../composables/useTaskActions";
import { useChecklistStore } from "../../stores/checklists";
import TaskCard from "../molecules/TaskCard.vue";
import MobilePlanningSheet from "../molecules/MobilePlanningSheet.vue";
import ChecklistCompletionModal from "../molecules/ChecklistCompletionModal.vue";
import SnoozeModal from "../molecules/SnoozeModal.vue";

type WeekMode = "planning" | "completion";

const props = defineProps<{
  itemsByPriority: {
    urgent: TrackedItemRef[];
    important: TrackedItemRef[];
    secondary: TrackedItemRef[];
  };
  dismissedKeys: Set<string>;
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

function onSnoozeSomeday(): void {
  if (pendingSnoozeTask.value) {
    store.sendItemToSomeday(refToId(pendingSnoozeTask.value))
    pendingSnoozeTask.value = null
  }
}

function onSnoozeCancel(): void {
  pendingSnoozeTask.value = null
}

function isDismissed(ref: TrackedItemRef): boolean {
  return mode.value === 'planning' && props.dismissedKeys.has(`${ref.checklistId}:${ref.item.id}`)
}

const mode = ref<WeekMode>("planning");

const priorityOrder: Record<string, number> = { urgent: 0, important: 1, secondary: 2 }

const sortedItems = computed((): TrackedItemRef[] => {
  const all = [
    ...props.itemsByPriority.urgent,
    ...props.itemsByPriority.important,
    ...props.itemsByPriority.secondary,
  ]
  return [...all].sort((a, b) => {
    const da = a.item.deadline ? new Date(a.item.deadline).getTime() : Infinity
    const db = b.item.deadline ? new Date(b.item.deadline).getTime() : Infinity
    if (da !== db) return da - db
    const pa = priorityOrder[a.item.priority ?? 'important'] ?? 1
    const pb = priorityOrder[b.item.priority ?? 'important'] ?? 1
    if (pa !== pb) return pa - pb
    if (a.checklistTitle !== b.checklistTitle) return a.checklistTitle.localeCompare(b.checklistTitle)
    return a.item.text.localeCompare(b.item.text)
  })
})

// ── TaskCard helpers ──────────────────────────────────────────────────────────

function weekSwipeLeft(taskRef: TrackedItemRef): SwipeActionDef {
  return {
    hint: '💤 Snooze',
    bgClass: 'bg-warning',
    onTrigger: () => openSnoozeModal(taskRef),
  }
}

function weekSwipeRight(taskRef: TrackedItemRef): SwipeActionDef {
  return {
    hint: 'Add to today',
    bgClass: 'bg-success',
    onTrigger: () => store.toggleItemDayPlan(refToId(taskRef)),
  }
}

function weekActions(taskRef: TrackedItemRef) {
  if (mode.value !== 'planning') return undefined
  if (taskRef.isChecklistTask) {
    return makeSnoozeSomedayDeleteActions(
      taskRef,
      (id, date) => store.snoozeItem(id, date),
      (id) => store.sendItemToSomeday(id),
      () => { /* checklist tasks not individually deletable */ },
    ).filter(a => a.label !== 'Delete')
  }
  return makeSnoozeSomedayDeleteActions(
    taskRef,
    (id, date) => store.snoozeItem(id, date),
    (id) => store.sendItemToSomeday(id),
    (id) => store.removeItem(id),
  )
}

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
</script>

<template>
  <div class="space-y-4">
    <!-- Mode toggle -->
    <div class="flex items-center gap-1 bg-bg-2/60 rounded-lg p-1 w-fit">
      <button
        class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
        :class="mode === 'planning' ? 'bg-primary text-white' : 'text-fg-3 hover:text-fg'"
        @click="mode = 'planning'"
      >Planning</button>
      <button
        class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
        :class="mode === 'completion' ? 'bg-primary text-white' : 'text-fg-3 hover:text-fg'"
        @click="mode = 'completion'"
      >Completion</button>
    </div>

    <div v-if="sortedItems.length === 0" class="text-xs text-fg-4 py-4 text-center">
      No tasks selected for this week.
    </div>

    <!-- Flat sorted task list -->
    <div class="space-y-3">
      <div
        v-for="ref in sortedItems"
        :key="ref.item.id"
        class="relative overflow-hidden rounded-xl"
        :class="isDismissed(ref) ? 'opacity-65' : ''"
        :title="isDismissed(ref) ? 'Excluded from today\'s suggestion' : undefined"
      >
        <!-- TODAY corner ribbon -->
        <div
          v-if="mode === 'planning' && ref.item.selectedForToday"
          class="absolute top-0 right-0 z-10 pointer-events-none pl-5 pr-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-900 bg-lime-400 rounded-bl-xl"
          style="clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 35% 100%)"
        >TODAY</div>

        <TaskCard
          :item="ref.item"
          :checklist-id="ref.checklistId"
          :checklist-title="ref.checklistTitle"
          :show-checklist-title="true"
          :show-checkbox="mode === 'completion'"
          :swipe-left="mode === 'planning' ? weekSwipeLeft(ref) : undefined"
          :swipe-right="mode === 'planning' ? weekSwipeRight(ref) : undefined"
          :actions="weekActions(ref)"
          :is-checklist-task="ref.isChecklistTask"
          :progress="ref.progress"
          :on-checklist-done="ref.isChecklistTask ? () => openCompletionModal(ref.checklistId) : undefined"
        >
          <template v-if="mode === 'planning'" #mobile-sheet="{ close }">
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
  </div>

  <!-- Checklist completion modal -->
  <ChecklistCompletionModal
    v-if="completionModalChecklist"
    :checklist="completionModalChecklist"
    @archive="onModalArchive"
    @close="onModalClose"
  />

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
</template>
