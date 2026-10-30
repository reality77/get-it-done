<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import type { Checklist } from '../../types'
import { useSwipeAction } from '../../composables/useSwipeAction'
import { makeKeydownHandler } from '../../composables/useKeyboardConfirm'
import { useEditableField } from '../../composables/useEditableField'
import { useChecklistStore } from '../../stores/checklists'
import { countItems, countDone, computeOrderedView } from '../../composables/useTreeHelpers'
import KindBadge from '../molecules/KindBadge.vue'
import VButton from '../atoms/VButton.vue'
import ItemRow from '../molecules/ItemRow.vue'
import ItemGroup from '../molecules/ItemGroup.vue'
import ChecklistSettingsSheet from '../molecules/ChecklistSettingsSheet.vue'

const props = defineProps<{
  checklist: Checklist
  autoFocusAddItem?: boolean
  forceExpanded?: boolean
}>()

const emit = defineEmits<{
  (e: 'delete', checklistId: string): void
  (e: 'run', checklistId: string): void
  (e: 'archive', checklistId: string): void
  (e: 'unarchive', checklistId: string): void
}>()

const {
  toggleItem, addItem, updateItemText, removeItem, addGroup,
  updateGroupTitle, toggleGroupCollapsed, removeGroup, updateChecklist,
} = useChecklistStore()

const isExpanded = ref(props.forceExpanded ?? false)

// Expanded while a filter matches one of the items; collapses back when it no longer does.
watch(() => props.forceExpanded, (force) => { isExpanded.value = !!force })

// ── Ordered checklist ─────────────────────────────────────────────────────────
const order = computed(() => props.checklist.ordered ? computeOrderedView(props.checklist.items) : null)

// ── Settings sheet ────────────────────────────────────────────────────────────
const settingsOpen = ref(false)

// ── Rename (tap the title) ────────────────────────────────────────────────────
// Runs display their run label, so that is what gets renamed.
const {
  isEditing: isEditingTitle, editText: titleText, startEdit: startTitleEdit,
  confirmEdit: confirmTitle, cancelEdit: cancelTitle,
} = useEditableField(
  () => displayTitle.value,
  (text) => updateChecklist(props.checklist.id, props.checklist.runLabel != null ? { runLabel: text } : { title: text }),
)
const onTitleKeydown = makeKeydownHandler(confirmTitle, cancelTitle)

// ── Item rows ─────────────────────────────────────────────────────────────────
const itemRowRefs = ref<InstanceType<typeof ItemRow>[]>([])

// ── Add item ──────────────────────────────────────────────────────────────────
const isAddingItem = ref(false)
const newItemText = ref('')
const addItemInputEl = ref<HTMLInputElement | null>(null)

async function startAddItem(): Promise<void> {
  itemRowRefs.value.forEach(r => r.cancelEdit())
  cancelAddGroup()
  isExpanded.value = true
  isAddingItem.value = true
  await nextTick()
  addItemInputEl.value?.focus()
}

function confirmAddItem(): void {
  const text = newItemText.value.trim()
  if (!text) { cancelAddItem(); return }
  addItem(props.checklist.id, text)
  newItemText.value = ''
}

function cancelAddItem(): void {
  isAddingItem.value = false
  newItemText.value = ''
}

onMounted(() => {
  if (props.autoFocusAddItem) startAddItem()
})

// ── Add group ─────────────────────────────────────────────────────────────────
const isAddingGroup = ref(false)
const newGroupTitle = ref('')
const addGroupInputEl = ref<HTMLInputElement | null>(null)

async function startAddGroup(): Promise<void> {
  itemRowRefs.value.forEach(r => r.cancelEdit())
  cancelAddItem()
  isExpanded.value = true
  isAddingGroup.value = true
  await nextTick()
  addGroupInputEl.value?.focus()
}

function confirmAddGroup(): void {
  const title = newGroupTitle.value.trim()
  if (!title) { cancelAddGroup(); return }
  addGroup(props.checklist.id, title)
  newGroupTitle.value = ''
}

function cancelAddGroup(): void {
  isAddingGroup.value = false
  newGroupTitle.value = ''
}

// ── Keyboard helpers ──────────────────────────────────────────────────────────
const onAddItemKeydown = makeKeydownHandler(confirmAddItem, cancelAddItem)
const onAddGroupKeydown = makeKeydownHandler(confirmAddGroup, cancelAddGroup)

// ── ItemGroup event handlers ──────────────────────────────────────────────────
function onToggleItem(checklistId: string, itemId: string): void {
  toggleItem({ checklistId, itemId })
}
function onUpdateItemText(checklistId: string, itemId: string, text: string): void {
  updateItemText({ checklistId, itemId }, text)
}
function onRemoveItem(checklistId: string, itemId: string): void {
  removeItem({ checklistId, itemId })
}

// ── Misc ──────────────────────────────────────────────────────────────────────
const displayTitle = computed(() => props.checklist.runLabel ?? props.checklist.title)
const doneCount = computed(() => countDone(props.checklist.items))
const totalCount = computed(() => countItems(props.checklist.items))
const isComplete = computed(
  () => props.checklist.kind !== 'template' && totalCount.value > 0 && doneCount.value === totalCount.value
)
const progressPct = computed(() =>
  totalCount.value > 0 ? Math.round((doneCount.value / totalCount.value) * 100) : 0
)

const animateComplete = ref(false)
watch(isComplete, (val) => {
  if (val) {
    animateComplete.value = true
    setTimeout(() => { animateComplete.value = false }, 600)
  }
})

// ── Swipe (mobile) ───────────────────────────────────────────────────────────
// Active: left = archive. Archived: left = delete for good, right = restore.
// An (un)archived card moves to the other list and is re-mounted, so reading
// `archived` once here is enough.
const cardHeaderEl = ref<HTMLElement | null>(null)
const isArchived = props.checklist.archived

const {
  isSwiping: isCardSwiping, style: cardStyle, leftProgress, rightProgress,
} = useSwipeAction(cardHeaderEl, {
  threshold: 100,
  guard: () => props.checklist.kind !== 'template' && !isEditingTitle.value,
  onLeft: () => isArchived ? emit('delete', props.checklist.id) : emit('archive', props.checklist.id),
  onRight: isArchived ? () => emit('unarchive', props.checklist.id) : undefined,
})
</script>

<template>
  <div ref="cardEl" class="relative overflow-hidden rounded-xl">
    <!-- Hints revealed as the card slides -->
    <div
      v-if="checklist.kind !== 'template'"
      class="absolute inset-0 flex items-center justify-end px-4 pointer-events-none"
      :class="isArchived ? 'bg-danger' : 'bg-warning'"
      :style="{ opacity: leftProgress * 0.9 }"
    >
      <span class="text-sm font-medium" :class="isArchived ? 'text-white' : 'text-bg-0'">
        {{ isArchived ? '🗑 Delete' : '🗄 Archive' }}
      </span>
    </div>
    <div
      v-if="isArchived"
      class="absolute inset-0 bg-success flex items-center justify-start px-4 pointer-events-none"
      :style="{ opacity: rightProgress * 0.9 }"
    >
      <span class="text-bg-0 text-sm font-medium">↩ Restore</span>
    </div>

  <!-- Sliding card content -->
  <div
    class="border rounded-xl p-4 transition-colors"
    :class="[
      isComplete ? 'bg-warning/20 border-warning' : 'bg-bg-1 border-hairline',
      animateComplete ? 'card-complete' : '',
      !isCardSwiping ? 'transition-transform duration-200' : '',
    ]"
    :style="cardStyle"
  >
    <!-- Header -->
    <div ref="cardHeaderEl" class="flex items-center gap-2 min-w-0">
      <button
        class="text-fg-3 hover:text-fg-2 transition-colors text-lg w-4 shrink-0 text-left"
        @click="isExpanded = !isExpanded"
      >
        {{ isExpanded ? '▾' : '▸' }}
      </button>

      <input
        v-if="isEditingTitle"
        v-focus
        v-model="titleText"
        class="flex-1 min-w-0 bg-transparent border-b border-border focus:border-primary outline-none font-medium text-lg text-fg py-0.5"
        @keydown="onTitleKeydown"
        @blur="confirmTitle"
      />
      <span
        v-else
        class="font-medium text-lg text-fg truncate flex-1 cursor-text"
        @click="startTitleEdit"
      >{{ displayTitle }}</span>

      <span class="hidden sm:contents"><KindBadge :kind="checklist.kind" /></span>

      <Transition name="check">
        <span
          v-if="isComplete"
          class="text-success shrink-0 text-base"
          title="All done!"
        >✓</span>
      </Transition>

      <!-- Actions -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Status hints (changed via the ⋯ sheet) -->
        <span v-if="checklist.trackMode !== 'none'" class="text-xs text-primary" title="Tracked as tasks">◎</span>
        <span v-if="checklist.ordered" class="text-xs text-primary" title="Ordered steps">1→2</span>
        <VButton
          v-if="checklist.kind === 'template'"
          variant="primary"
          size="sm"
          title="Start a run"
          @click="$emit('run', checklist.id)"
        >
          ▷
        </VButton>
        <!-- Desktop only; mobile archives by swiping. Wrapped because VButton's own inline-flex beats `hidden`. -->
        <span v-if="isArchived" class="hidden sm:contents">
          <VButton variant="ghost" size="sm" title="Restore" @click="$emit('unarchive', checklist.id)">↩</VButton>
          <VButton variant="ghost" size="sm" title="Delete for good" @click="$emit('delete', checklist.id)">🗑</VButton>
        </span>
        <span v-else-if="checklist.kind !== 'template'" class="hidden sm:contents">
          <VButton
            variant="ghost"
            size="sm"
            title="Archive"
            @click="$emit('archive', checklist.id)"
          >
            🗄
          </VButton>
        </span>
        <button
          class="w-9 h-9 -mr-2 flex items-center justify-center rounded-full text-fg-3 hover:text-fg hover:bg-bg-2 transition-colors text-xl leading-none"
          title="Checklist settings"
          aria-label="Checklist settings"
          @click="settingsOpen = true"
        >
          ⋯
        </button>
      </div>
    </div>

    <ChecklistSettingsSheet
      :checklist="checklist"
      :open="settingsOpen"
      @close="settingsOpen = false"
    />

    <!-- Progress bar -->
    <div
      v-if="!isComplete && checklist.kind !== 'template' && totalCount > 0"
      class="mt-2 h-1 bg-bg-2 rounded-full overflow-hidden"
    >
      <div
        class="h-full bg-primary rounded-full transition-all duration-300"
        :style="{ width: `${progressPct}%` }"
      />
    </div>

    <!-- Body -->
    <div v-if="isExpanded" class="mt-3 pl-5">
      <template v-for="node in checklist.items" :key="node.id">
        <ItemRow
          v-if="node.type === 'item'"
          ref="itemRowRefs"
          :item="node"
          :tracked="checklist.trackMode === 'items'"
          :step="order?.steps.get(node.id)"
          :is-next-step="order?.nextItemId === node.id"
          @toggle="toggleItem({ checklistId: checklist.id, itemId: node.id })"
          @update-text="(text) => updateItemText({ checklistId: checklist.id, itemId: node.id }, text)"
          @remove="removeItem({ checklistId: checklist.id, itemId: node.id })"
          @start-edit="cancelAddItem"
        />
        <ItemGroup
          v-else-if="node.type === 'group'"
          :group="node"
          :checklist-id="checklist.id"
          :tracked="checklist.trackMode === 'items'"
          :order="order"
          @toggle-item="onToggleItem"
          @update-item-text="onUpdateItemText"
          @remove-item="onRemoveItem"
          @add-item="addItem"
          @add-group="addGroup"
          @update-group-title="updateGroupTitle"
          @toggle-group-collapsed="toggleGroupCollapsed"
          @remove-group="removeGroup"
        />
      </template>

      <!-- Inline new-item input -->
      <div v-if="isAddingItem" class="flex items-center gap-2 py-1 mt-1">
        <input
          ref="addItemInputEl"
          v-model="newItemText"
          placeholder="New item…"
          class="bg-transparent border-b border-border focus:border-primary outline-none text-fg py-0.5 placeholder:text-fg-4 transition-colors flex-1"
          @keydown="onAddItemKeydown"
          @blur="cancelAddItem"
        />
      </div>

      <!-- Inline new-group input -->
      <div v-if="isAddingGroup" class="flex items-center gap-2 py-1 mt-1">
        <input
          ref="addGroupInputEl"
          v-model="newGroupTitle"
          placeholder="Group name…"
          class="bg-transparent border-b border-border focus:border-primary outline-none text-fg py-0.5 placeholder:text-fg-4 transition-colors flex-1 font-medium"
          @keydown="onAddGroupKeydown"
          @blur="cancelAddGroup"
        />
      </div>

      <!-- Footer buttons -->
      <div v-if="!isAddingItem && !isAddingGroup" class="flex items-center gap-4 mt-2">
        <button
          class="text-xs text-fg-4 hover:text-fg-2 transition-colors"
          @click="startAddItem"
        >
          + Add item
        </button>
        <button
          class="text-xs text-fg-4 hover:text-fg-2 transition-colors"
          @click="startAddGroup"
        >
          + Add group
        </button>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* Card pulse on completion */
@keyframes card-pulse {
  0%   { transform: scale(1);     box-shadow: 0 0 0 0   rgba(134, 239, 172, 0.35); }
  40%  { transform: scale(1.018); box-shadow: 0 0 0 8px rgba(134, 239, 172, 0); }
  100% { transform: scale(1);     box-shadow: 0 0 0 0   rgba(134, 239, 172, 0); }
}
.card-complete {
  animation: card-pulse 0.55s ease-out;
}

/* Checkmark spring pop-in */
.check-enter-active {
  animation: check-bounce 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}
@keyframes check-bounce {
  0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
  60%  { transform: scale(1.3)  rotate(5deg);  opacity: 1; }
  100% { transform: scale(1)   rotate(0deg); }
}
</style>
