<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import type { Checklist } from '../../types'
import { useSwipeAction } from '../../composables/useSwipeAction'
import { makeKeydownHandler } from '../../composables/useKeyboardConfirm'
import { useChecklistStore } from '../../stores/checklists'
import { countItems, countDone, computeOrderedView } from '../../composables/useTreeHelpers'
import type { ChecklistNode } from '../../types'
import KindBadge from '../molecules/KindBadge.vue'
import VButton from '../atoms/VButton.vue'
import ItemRow from '../molecules/ItemRow.vue'
import ItemGroup from '../molecules/ItemGroup.vue'
import TrackButton from '../molecules/TrackButton.vue'

const props = defineProps<{
  checklist: Checklist
  autoFocusAddItem?: boolean
}>()

const emit = defineEmits<{
  (e: 'delete', checklistId: string): void
  (e: 'run', checklistId: string): void
  (e: 'archive', checklistId: string): void
}>()

const {
  toggleItem, addItem, updateItemText, removeItem, addGroup,
  updateGroupTitle, toggleGroupCollapsed, removeGroup, setOrdered,
} = useChecklistStore()

const isExpanded = ref(true)

// ── Ordered checklist ─────────────────────────────────────────────────────────
const order = computed(() => props.checklist.ordered ? computeOrderedView(props.checklist.items) : null)
// Temporarily show steps after the next one (e.g. while adding items)
const revealAll = ref(false)

function isShown(node: ChecklistNode): boolean {
  return !order.value || revealAll.value || order.value.visibleIds.has(node.id)
}

function toggleOrdered(): void {
  setOrdered(props.checklist.id, !props.checklist.ordered)
  revealAll.value = false
}

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
  revealAll.value = true
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
  revealAll.value = true
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
function onAddItem(checklistId: string, text: string, groupId: string): void {
  addItem(checklistId, text, groupId)
  revealAll.value = true
}
function onAddGroup(checklistId: string, title: string, parentGroupId: string): void {
  addGroup(checklistId, title, parentGroupId)
  revealAll.value = true
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

// ── Swipe-to-archive (mobile) ────────────────────────────────────────────────
const cardHeaderEl = ref<HTMLElement | null>(null)

const { isSwiping: isCardSwiping, style: cardStyle, leftProgress: archiveProgress } = useSwipeAction(cardHeaderEl, {
  threshold: 100,
  guard: () => props.checklist.kind !== 'template',
  onLeft: () => emit('archive', props.checklist.id),
})
</script>

<template>
  <div ref="cardEl" class="relative overflow-hidden rounded-xl">
    <!-- Yellow archive hint revealed as card slides left -->
    <div
      v-if="checklist.kind !== 'template'"
      class="absolute inset-0 bg-warning flex items-center justify-end px-4 pointer-events-none"
      :style="{ opacity: archiveProgress * 0.9 }"
    >
      <span class="text-bg-0 text-sm font-medium">🗄 Archive</span>
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

      <span class="font-medium text-lg text-fg truncate flex-1">{{ displayTitle }}</span>

      <span class="hidden sm:contents"><KindBadge :kind="checklist.kind" /></span>

      <Transition name="check">
        <span
          v-if="isComplete"
          class="text-success shrink-0 text-base"
          title="All done!"
        >✓</span>
      </Transition>

      <!-- Actions -->
      <div class="flex items-center gap-3 shrink-0">
        <!-- Ordered toggle -->
        <button
          v-if="!checklist.archived"
          class="text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer"
          :class="checklist.ordered
            ? 'bg-primary/20 border-primary text-primary'
            : 'border-border text-fg-4 hover:border-border-strong hover:text-fg-2'"
          :title="checklist.ordered ? 'Ordered — click to make unordered' : 'Make ordered (one step after another)'"
          @click="toggleOrdered"
        >
          1→2
        </button>
        <!-- Track as tasks toggle -->
        <TrackButton :checklist="checklist" />
        <VButton
          v-if="checklist.kind === 'template'"
          variant="primary"
          @click="$emit('run', checklist.id)"
        >
          ▷
        </VButton>
        <VButton
          v-if="checklist.kind !== 'template'"
          variant="ghost"
          class="font-bold hidden sm:inline-flex"
          title="Archive"
          @click="$emit('archive', checklist.id)"
        >
          🗄
        </VButton>
        <VButton v-if="props.checklist.archived === true"
          variant="danger" @click="$emit('delete', checklist.id)">Delete</VButton>
      </div>
    </div>

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
      <template v-for="node in checklist.items.filter(isShown)" :key="node.id">
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
          :reveal-all="revealAll"
          @toggle-item="onToggleItem"
          @update-item-text="onUpdateItemText"
          @remove-item="onRemoveItem"
          @add-item="onAddItem"
          @add-group="onAddGroup"
          @update-group-title="updateGroupTitle"
          @toggle-group-collapsed="toggleGroupCollapsed"
          @remove-group="removeGroup"
        />
      </template>

      <!-- Upcoming steps of an ordered checklist -->
      <button
        v-if="order && order.hiddenCount > 0"
        class="text-xs text-fg-4 hover:text-fg-2 transition-colors mt-1"
        @click="revealAll = !revealAll"
      >
        {{ revealAll
          ? 'Hide upcoming steps'
          : `+ ${order.hiddenCount} upcoming step${order.hiddenCount > 1 ? 's' : ''} hidden` }}
      </button>

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
