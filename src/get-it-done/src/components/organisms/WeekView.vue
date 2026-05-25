<script setup lang="ts">
import { ref, computed } from "vue";
import type {
  TrackedItemRef,
  TaskPriority,
  SwipeActionDef,
} from "../../types";
import { makeSnoozeSomedayDeleteActions, refToId } from "../../composables/useTaskActions";
import { useChecklistStore } from "../../stores/checklists";
import TaskCard from "../molecules/TaskCard.vue";
import MobilePlanningSheet from "../molecules/MobilePlanningSheet.vue";
import ChecklistCompletionModal from "../molecules/ChecklistCompletionModal.vue";

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

function isDismissed(ref: TrackedItemRef): boolean {
  return mode.value === 'planning' && props.dismissedKeys.has(`${ref.checklistId}:${ref.item.id}`)
};

const collapsed = ref<Record<TaskPriority, boolean>>({
  urgent: false,
  important: false,
  secondary: false,
});

const mode = ref<WeekMode>("planning");

const sections: { priority: TaskPriority; label: string; dotColor: string; borderColor: string }[] =
  [
    { priority: "urgent",    label: "Urgent",    dotColor: "bg-danger",    borderColor: "border-danger/50" },
    { priority: "important", label: "Important", dotColor: "bg-warning", borderColor: "border-warning/50" },
    { priority: "secondary", label: "Secondary", dotColor: "bg-fg-4",   borderColor: "border-border-strong/50" },
  ];

/** Group items within a priority section by their checklist title */
function groupByChecklist(
  items: TrackedItemRef[],
): Map<string, TrackedItemRef[]> {
  const map = new Map<string, TrackedItemRef[]>();
  for (const ref of items) {
    const key = ref.checklistTitle;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ref);
  }
  return map;
}

// ── Drag-and-drop (desktop) ───────────────────────────────────────────────────
interface DragState {
  checklistId: string;
  itemId: string;
  fromPriority: TaskPriority;
}

const dragging = ref<DragState | null>(null);
const dragOverPriority = ref<TaskPriority | null>(null);
// Counter tracks enter/leave nesting to avoid flicker
const dragEnterCount = ref<Partial<Record<TaskPriority, number>>>({});

function onDragStart(e: DragEvent, item: TrackedItemRef): void {
  dragging.value = {
    checklistId: item.checklistId,
    itemId: item.item.id,
    fromPriority: item.item.priority ?? "secondary",
  };
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.item.id);
  }
}

function onDragEnd(): void {
  dragging.value = null;
  dragOverPriority.value = null;
  dragEnterCount.value = {};
}

function onDragEnter(priority: TaskPriority): void {
  dragEnterCount.value[priority] = (dragEnterCount.value[priority] ?? 0) + 1;
  dragOverPriority.value = priority;
}

function onDragLeave(priority: TaskPriority): void {
  dragEnterCount.value[priority] = Math.max(0, (dragEnterCount.value[priority] ?? 1) - 1);
  if ((dragEnterCount.value[priority] ?? 0) === 0 && dragOverPriority.value === priority) {
    dragOverPriority.value = null;
  }
}

function onDrop(priority: TaskPriority): void {
  if (!dragging.value) return;
  if (priority !== dragging.value.fromPriority) {
    store.setItemPriority({
      checklistId: dragging.value.checklistId,
      itemId: dragging.value.itemId,
    }, priority);
  }
  dragging.value = null;
  dragOverPriority.value = null;
  dragEnterCount.value = {};
}

// ── Touch drag-and-drop (mobile) ──────────────────────────────────────────────
const touchDragging = ref<DragState | null>(null);
const touchTargetPriority = ref<TaskPriority | null>(null);

// ── TaskCard helpers ──────────────────────────────────────────────────────────

function weekSwipeLeft(taskRef: TrackedItemRef): SwipeActionDef {
  return {
    hint: '💤 Next week',
    bgClass: 'bg-warning',
    onTrigger: () => {
      const d = new Date()
      d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7))
      store.snoozeItem(refToId(taskRef), d.toISOString().slice(0, 10))
    },
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
  <div class="space-y-6">
    <!-- Mode toggle -->
    <div class="flex items-center gap-1 bg-bg-2/60 rounded-lg p-1 w-fit">
      <button
        class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
        :class="
          mode === 'planning'
            ? 'bg-primary text-white'
            : 'text-fg-3 hover:text-fg'
        "
        @click="mode = 'planning'"
      >
        Planning
      </button>
      <button
        class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
        :class="
          mode === 'completion'
            ? 'bg-primary text-white'
            : 'text-fg-3 hover:text-fg'
        "
        @click="mode = 'completion'"
      >
        Completion
      </button>
    </div>

    <section
      v-for="section in sections"
      :key="section.priority"
      :data-priority="section.priority"
      class="rounded-xl transition-colors duration-150"
      :class="(dragOverPriority === section.priority && dragging?.fromPriority !== section.priority) ||
              (touchTargetPriority === section.priority && touchDragging?.fromPriority !== section.priority)
        ? ['border-2', section.borderColor, 'bg-bg-2/40']
        : 'border-2 border-transparent'"
      @dragover.prevent
      @dragenter="onDragEnter(section.priority)"
      @dragleave="onDragLeave(section.priority)"
      @drop.prevent="onDrop(section.priority)"
    >
      <!-- Section header -->
      <div class="flex items-center gap-2 mb-2">
        <span class="w-2 h-2 rounded-full shrink-0" :class="section.dotColor" />
        <button
          class="flex-1 text-left text-sm font-semibold text-fg-2 hover:text-fg transition-colors cursor-pointer"
          @click="collapsed[section.priority] = !collapsed[section.priority]"
        >
          {{ section.label }}
          <span class="text-fg-4 font-normal ml-1">
            ({{ itemsByPriority[section.priority].length }})
          </span>
        </button>
      </div>

      <!-- Drop hint (mouse or touch) -->
      <div
        v-if="(dragOverPriority === section.priority && dragging?.fromPriority !== section.priority) ||
              (touchTargetPriority === section.priority && touchDragging?.fromPriority !== section.priority)"
        class="text-xs font-medium text-fg-3 pl-4 pb-2 pointer-events-none select-none"
      >
        ↓ Drop here to mark as {{ section.label }}
      </div>

      <!-- Items grouped by checklist -->
      <div v-if="!collapsed[section.priority]" class="space-y-3">
        <div
          v-if="itemsByPriority[section.priority].length === 0"
          class="text-xs text-fg-4 py-2"
        >
          No {{ section.label.toLowerCase() }} items
        </div>

        <div
          v-for="[clTitle, refs] in groupByChecklist(
            itemsByPriority[section.priority],
          )"
          :key="clTitle"
          class="rounded-lg border border-border/50 bg-bg-2/20"
        >
          <!-- Checklist group header -->
          <div class="px-3 py-1.5 border-b border-border/40 bg-bg-2/40 rounded-t-lg">
            <span class="text-xs font-semibold text-fg truncate">{{ clTitle }}</span>
          </div>
          <!-- Task cards -->
          <div class="p-1.5 space-y-0.5">
            <div
              v-for="ref in refs"
              :key="ref.item.id"
              class="relative transition border-l-2"
              :class="[
                dragging?.itemId === ref.item.id || touchDragging?.itemId === ref.item.id ? 'opacity-40'
                  : isDismissed(ref) ? 'opacity-65' : '',
                mode === 'planning' && ref.item.selectedForToday ? 'border-primary'
                  : isDismissed(ref) ? 'border-border' : 'border-transparent',
              ]"
              :title="isDismissed(ref) ? 'Excluded from today\'s suggestion' : undefined"
              draggable="true"
              @dragstart="onDragStart($event, ref)"
              @dragend="onDragEnd"
            >

              <TaskCard
                :item="ref.item"
                :checklist-id="ref.checklistId"
                :checklist-title="ref.checklistTitle"
                :show-checklist-title="false"
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
                  />
                </template>
              </TaskCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <!-- Checklist completion modal -->
  <ChecklistCompletionModal
    v-if="completionModalChecklist"
    :checklist="completionModalChecklist"
    @archive="onModalArchive"
    @close="onModalClose"
  />
</template>
