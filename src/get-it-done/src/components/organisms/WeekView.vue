<script setup lang="ts">
import { ref } from "vue";
import type {
  TrackedItemRef,
  TaskPriority,
  TaskEffort,
  ChecklistItemId,
  ButtonActionDef,
  SwipeActionDef,
} from "../../types";
import TaskCard from "../molecules/TaskCard.vue";
import MobilePlanningSheet from "../molecules/MobilePlanningSheet.vue";

type WeekMode = "planning" | "completion";

const props = defineProps<{
  itemsByPriority: {
    urgent: TrackedItemRef[];
    important: TrackedItemRef[];
    secondary: TrackedItemRef[];
  };
}>();

const emit = defineEmits<{
  (e: "snooze", id: ChecklistItemId, date: string): void;
  (e: "someday", id: ChecklistItemId): void;
  (e: "delete", id: ChecklistItemId): void;
  (e: "update-priority", id: ChecklistItemId, priority: TaskPriority): void;
  (e: "update-effort", id: ChecklistItemId, effort: TaskEffort): void;
  (e: "update-text", id: ChecklistItemId, text: string): void;
  (e: "toggle-day", id: ChecklistItemId): void;
  (e: "toggle-done", id: ChecklistItemId): void;
}>();

const collapsed = ref<Record<TaskPriority, boolean>>({
  urgent: false,
  important: false,
  secondary: false,
});

const mode = ref<WeekMode>("planning");

const sections: { priority: TaskPriority; label: string; dotColor: string; borderColor: string }[] =
  [
    { priority: "urgent",    label: "Urgent",    dotColor: "bg-red-500",    borderColor: "border-red-500/50" },
    { priority: "important", label: "Important", dotColor: "bg-yellow-500", borderColor: "border-yellow-500/50" },
    { priority: "secondary", label: "Secondary", dotColor: "bg-zinc-500",   borderColor: "border-zinc-500/50" },
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
    emit("update-priority", {
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
let touchGhostEl: HTMLElement | null = null;

function onHandleTouchStart(e: TouchEvent, item: TrackedItemRef): void {
  if (e.touches.length !== 1) return;
  e.preventDefault(); // prevent scroll while dragging

  touchDragging.value = {
    checklistId: item.checklistId,
    itemId: item.item.id,
    fromPriority: item.item.priority ?? "secondary",
  };
  touchTargetPriority.value = null;

  // Create a lightweight ghost pill
  const touch = e.touches[0];
  if (!touch) return;
  touchGhostEl = document.createElement("div");
  touchGhostEl.textContent = item.item.text;
  touchGhostEl.style.cssText = [
    "position:fixed",
    `left:${touch.clientX - 60}px`,
    `top:${touch.clientY - 18}px`,
    "max-width:220px",
    "padding:6px 12px",
    "border-radius:8px",
    "background:#3f3f46",
    "color:#e4e4e7",
    "font-size:12px",
    "white-space:nowrap",
    "overflow:hidden",
    "text-overflow:ellipsis",
    "opacity:0.9",
    "pointer-events:none",
    "z-index:9999",
    "box-shadow:0 4px 12px rgba(0,0,0,0.5)",
  ].join(";");
  document.body.appendChild(touchGhostEl);

  document.addEventListener("touchmove", onTouchDragMove, { passive: false });
  document.addEventListener("touchend", onTouchDragEnd);
  document.addEventListener("touchcancel", onTouchDragEnd);
}

function onTouchDragMove(e: TouchEvent): void {
  if (!touchDragging.value || !touchGhostEl) return;
  e.preventDefault();

  const touch = e.touches[0];
  if (!touch) return;
  touchGhostEl.style.left = `${touch.clientX - 60}px`;
  touchGhostEl.style.top = `${touch.clientY - 18}px`;

  // Ghost has pointer-events:none so elementFromPoint sees through it
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  const sectionEl = el?.closest("[data-priority]");
  touchTargetPriority.value =
    (sectionEl?.getAttribute("data-priority") as TaskPriority) ?? null;
}

// ── TaskCard helpers ──────────────────────────────────────────────────────────

function weekSwipeLeft(ref: TrackedItemRef): SwipeActionDef {
  return {
    hint: '💤 Next monday',
    bgClass: 'bg-amber-700',
    onTrigger() {
      const id: ChecklistItemId = { checklistId: ref.checklistId, itemId: ref.item.id }
      const d = new Date()
      d.setDate(d.getDate() + (1 + 7 - d.getDay()) % 7 || 7)
      emit('snooze', id, d.toISOString().slice(0, 10))
    },
  }
}

function weekSwipeRight(ref: TrackedItemRef): SwipeActionDef {
  return {
    hint: '☁ Someday',
    bgClass: 'bg-sky-700',
    onTrigger() {
      emit('someday', { checklistId: ref.checklistId, itemId: ref.item.id })
    },
  }
}

function weekActions(ref: TrackedItemRef): ButtonActionDef[] | undefined {
  if (mode.value !== 'planning') return undefined
  const id: ChecklistItemId = { checklistId: ref.checklistId, itemId: ref.item.id }
  return [
    { label: '💤', title: 'Snooze', variant: 'icon', snooze: (date) => emit('snooze', id, date) },
    { label: '☁', title: 'Someday', variant: 'icon', onClick: () => emit('someday', id) },
    { label: '✕', title: 'Delete', variant: 'danger', onClick: () => emit('delete', id) },
  ]
}

function onTouchDragEnd(): void {
  if (
    touchDragging.value &&
    touchTargetPriority.value &&
    touchTargetPriority.value !== touchDragging.value.fromPriority
  ) {
    emit(
      "update-priority",
      {
        checklistId: touchDragging.value.checklistId,
        itemId: touchDragging.value.itemId,
      },
      touchTargetPriority.value,
    );
  }

  touchGhostEl?.remove();
  touchGhostEl = null;
  touchDragging.value = null;
  touchTargetPriority.value = null;

  document.removeEventListener("touchmove", onTouchDragMove);
  document.removeEventListener("touchend", onTouchDragEnd);
  document.removeEventListener("touchcancel", onTouchDragEnd);
}
</script>

<template>
  <div class="space-y-6">
    <!-- Mode toggle -->
    <div class="flex items-center gap-1 bg-zinc-800/60 rounded-lg p-1 w-fit">
      <button
        class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
        :class="
          mode === 'planning'
            ? 'bg-violet-600 text-white'
            : 'text-zinc-400 hover:text-zinc-200'
        "
        @click="mode = 'planning'"
      >
        Planning
      </button>
      <button
        class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
        :class="
          mode === 'completion'
            ? 'bg-violet-600 text-white'
            : 'text-zinc-400 hover:text-zinc-200'
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
        ? ['border-2', section.borderColor, 'bg-zinc-800/40']
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
          class="flex-1 text-left text-sm font-semibold text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
          @click="collapsed[section.priority] = !collapsed[section.priority]"
        >
          {{ section.label }}
          <span class="text-zinc-600 font-normal ml-1">
            ({{ itemsByPriority[section.priority].length }})
          </span>
        </button>
      </div>

      <!-- Drop hint (mouse or touch) -->
      <div
        v-if="(dragOverPriority === section.priority && dragging?.fromPriority !== section.priority) ||
              (touchTargetPriority === section.priority && touchDragging?.fromPriority !== section.priority)"
        class="text-xs font-medium text-zinc-400 pl-4 pb-2 pointer-events-none select-none"
      >
        ↓ Drop here to mark as {{ section.label }}
      </div>

      <!-- Items grouped by checklist -->
      <div v-if="!collapsed[section.priority]" class="space-y-3 pl-4">
        <div
          v-if="itemsByPriority[section.priority].length === 0"
          class="text-xs text-zinc-600 py-2"
        >
          No {{ section.label.toLowerCase() }} items
        </div>

        <div
          v-for="[clTitle, refs] in groupByChecklist(
            itemsByPriority[section.priority],
          )"
          :key="clTitle"
        >
          <!-- Checklist sub-header -->
          <p class="text-xs text-zinc-500 mb-1 font-medium">{{ clTitle }}</p>
          <div class="space-y-0.5">
            <div
              v-for="ref in refs"
              :key="ref.item.id"
              class="relative transition-opacity duration-150"
              :class="dragging?.itemId === ref.item.id || touchDragging?.itemId === ref.item.id ? 'opacity-40' : ''"
              draggable="true"
              @dragstart="onDragStart($event, ref)"
              @dragend="onDragEnd"
            >

              <!-- Day plan toggle checkbox (planning mode only) -->
              <button
                v-if="mode === 'planning'"
                class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 w-3.5 h-3.5 rounded border transition-colors cursor-pointer"
                :class="
                  ref.item.selectedForToday
                    ? 'bg-violet-600 border-violet-600'
                    : 'border-zinc-700 hover:border-zinc-500'
                "
                :title="
                  ref.item.selectedForToday
                    ? 'Remove from today'
                    : 'Add to today'
                "
                @click="
                  $emit('toggle-day', {
                    checklistId: ref.checklistId,
                    itemId: ref.item.id,
                  })
                "
              >
                <span
                  v-if="ref.item.selectedForToday"
                  class="text-white text-[10px] leading-none flex items-center justify-center w-full h-full"
                  >✓</span
                >
              </button>

              <TaskCard
                :item="ref.item"
                :checklist-id="ref.checklistId"
                :checklist-title="ref.checklistTitle"
                :show-checkbox="mode === 'completion'"
                :swipe-left="mode === 'planning' ? weekSwipeLeft(ref) : undefined"
                :swipe-right="mode === 'planning' ? weekSwipeRight(ref) : undefined"
                :actions="weekActions(ref)"
                @toggle-done="(id) => $emit('toggle-done', id)"
                @update-text="(id, text) => $emit('update-text', id, text)"
              >
                <template v-if="mode === 'planning'" #mobile-sheet="{ close }">
                  <MobilePlanningSheet
                    :item="ref.item"
                    :item-id="{ checklistId: ref.checklistId, itemId: ref.item.id }"
                    :close="close"
                    @snooze="(id, date) => $emit('snooze', id, date)"
                    @someday="(id) => $emit('someday', id)"
                    @update-priority="(id, p) => $emit('update-priority', id, p)"
                    @update-effort="(id, e) => $emit('update-effort', id, e)"
                  />
                </template>
              </TaskCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
