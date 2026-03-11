<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import type { Checklist } from '../../types'
import { useSwipeAction } from '../../composables/useSwipeAction'
import { useChecklistStore } from '../../stores/checklists'
import { countItems, countDone } from '../../composables/useTreeHelpers'
import KindBadge from '../molecules/KindBadge.vue'
import AppButton from '../atoms/AppButton.vue'
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
  updateGroupTitle, toggleGroupCollapsed, removeGroup,
} = useChecklistStore()

const isExpanded = ref(true)

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
function makeKeydownHandler(onEnter: () => void, onEscape: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onEnter() }
    else if (e.key === 'Escape') { onEscape() }
  }
}

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
      class="absolute inset-0 bg-yellow-400 flex items-center justify-end px-4 pointer-events-none"
      :style="{ opacity: archiveProgress * 0.9 }"
    >
      <span class="text-yellow-950 text-sm font-medium">🗄 Archive</span>
    </div>

  <!-- Sliding card content -->
  <div
    class="border rounded-xl p-4 transition-colors"
    :class="[
      isComplete ? 'bg-yellow-950 border-yellow-400' : 'bg-zinc-900 border-zinc-800',
      animateComplete ? 'card-complete' : '',
      !isCardSwiping ? 'transition-transform duration-200' : '',
    ]"
    :style="cardStyle"
  >
    <!-- Header -->
    <div ref="cardHeaderEl" class="flex items-center gap-2 min-w-0">
      <button
        class="text-zinc-600 hover:text-zinc-300 transition-colors text-lg w-4 shrink-0 text-left"
        @click="isExpanded = !isExpanded"
      >
        {{ isExpanded ? '▾' : '▸' }}
      </button>

      <span class="font-medium text-lg text-zinc-100 truncate flex-1">{{ displayTitle }}</span>

      <span class="hidden sm:contents"><KindBadge :kind="checklist.kind" /></span>

      <Transition name="check">
        <span
          v-if="isComplete"
          class="text-green-400 shrink-0 text-base"
          title="All done!"
        >✓</span>
      </Transition>

      <!-- Actions -->
      <div class="flex items-center gap-3 shrink-0">
        <!-- Track as tasks toggle -->
        <TrackButton :checklist="checklist" />
        <AppButton
          v-if="checklist.kind === 'template'"
          variant="primary"
          @click="$emit('run', checklist.id)"
        >
          ▷
        </AppButton>
        <AppButton
          v-if="checklist.kind !== 'template'"
          variant="ghost"
          class="font-bold hidden sm:inline-flex"
          title="Archive"
          @click="$emit('archive', checklist.id)"
        >
          🗄
        </AppButton>
        <AppButton v-if="props.checklist.archived === true"
          variant="danger" @click="$emit('delete', checklist.id)">Delete</AppButton>
      </div>
    </div>

    <!-- Progress bar -->
    <div
      v-if="!isComplete && checklist.kind !== 'template' && totalCount > 0"
      class="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden"
    >
      <div
        class="h-full bg-violet-500 rounded-full transition-all duration-300"
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
          :tracked="checklist.tracked"
          @toggle="toggleItem({ checklistId: checklist.id, itemId: node.id })"
          @update-text="(text) => updateItemText({ checklistId: checklist.id, itemId: node.id }, text)"
          @remove="removeItem({ checklistId: checklist.id, itemId: node.id })"
          @start-edit="cancelAddItem"
        />
        <ItemGroup
          v-else-if="node.type === 'group'"
          :group="node"
          :checklist-id="checklist.id"
          :tracked="checklist.tracked"
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
          class="bg-transparent border-b border-zinc-700 focus:border-violet-500 outline-none text-zinc-100 py-0.5 placeholder:text-zinc-600 transition-colors flex-1"
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
          class="bg-transparent border-b border-zinc-700 focus:border-violet-500 outline-none text-zinc-200 py-0.5 placeholder:text-zinc-600 transition-colors flex-1 font-medium"
          @keydown="onAddGroupKeydown"
          @blur="cancelAddGroup"
        />
      </div>

      <!-- Footer buttons -->
      <div v-if="!isAddingItem && !isAddingGroup" class="flex items-center gap-4 mt-2">
        <button
          class="text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
          @click="startAddItem"
        >
          + Add item
        </button>
        <button
          class="text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
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
