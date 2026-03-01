<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { Checklist, ChecklistItem } from '../../types'
import AppBadge from '../atoms/AppBadge.vue'
import AppButton from '../atoms/AppButton.vue'

const props = defineProps<{
  checklist: Checklist
}>()

const emit = defineEmits<{
  (e: 'toggle-item', checklistId: string, itemId: string): void
  (e: 'add-item', checklistId: string, text: string): void
  (e: 'update-item-text', checklistId: string, itemId: string, text: string): void
  (e: 'remove-item', checklistId: string, itemId: string): void
  (e: 'edit', checklistId: string): void
  (e: 'delete', checklistId: string): void
  (e: 'run', checklistId: string): void
  (e: 'archive', checklistId: string): void
}>()

const isExpanded = ref(true)

// ── Add item ────────────────────────────────────────────────────────────────
const isAddingItem = ref(false)
const newItemText = ref('')
const addItemInputEl = ref<HTMLInputElement | null>(null)

async function startAddItem(): Promise<void> {
  if (editingItemId.value) cancelEditItem()
  isExpanded.value = true
  isAddingItem.value = true
  await nextTick()
  addItemInputEl.value?.focus()
}

function confirmAddItem(): void {
  const text = newItemText.value.trim()
  if (!text) { cancelAddItem(); return }
  emit('add-item', props.checklist.id, text)
  newItemText.value = ''
}

function cancelAddItem(): void {
  isAddingItem.value = false
  newItemText.value = ''
}

function makeKeydownHandler(onEnter: () => void, onEscape: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onEnter() }
    else if (e.key === 'Escape') { onEscape() }
  }
}

const onAddItemKeydown = makeKeydownHandler(confirmAddItem, cancelAddItem)

// ── Edit item ────────────────────────────────────────────────────────────────
const editingItemId = ref<string | null>(null)
const editingItemText = ref('')

// Focuses and selects the edit input as soon as it mounts
const vFocus = {
  mounted(el: Element) {
    const input = el as HTMLInputElement
    input.focus()
    input.select()
  },
}

function startEditItem(item: ChecklistItem): void {
  if (isAddingItem.value) cancelAddItem()
  editingItemId.value = item.id
  editingItemText.value = item.text
}

function confirmEditItem(): void {
  if (!editingItemId.value) return
  const text = editingItemText.value.trim()
  if (text) emit('update-item-text', props.checklist.id, editingItemId.value, text)
  editingItemId.value = null
  editingItemText.value = ''
}

function cancelEditItem(): void {
  editingItemId.value = null
  editingItemText.value = ''
}

const onEditItemKeydown = makeKeydownHandler(confirmEditItem, cancelEditItem)

// ── Misc ─────────────────────────────────────────────────────────────────────
const displayTitle = computed(() => props.checklist.runLabel ?? props.checklist.title)
const doneCount = computed(() => props.checklist.items.reduce((n, i) => n + (i.done ? 1 : 0), 0))
const totalCount = computed(() => props.checklist.items.length)
const isComplete = computed(
  () => props.checklist.kind !== 'template' && totalCount.value > 0 && doneCount.value === totalCount.value
)
const progressPct = computed(() =>
  totalCount.value > 0 ? Math.round((doneCount.value / totalCount.value) * 100) : 0
)
</script>

<template>
  <div
    class="border rounded-xl p-4 transition-colors"
    :class="isComplete ? 'bg-green-950 border-green-700' : 'bg-zinc-900 border-zinc-800'"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 min-w-0">
      <button
        class="text-zinc-600 hover:text-zinc-300 transition-colors text-xs w-4 shrink-0 text-left"
        @click="isExpanded = !isExpanded"
      >
        {{ isExpanded ? '▾' : '▸' }}
      </button>

      <span class="font-medium text-zinc-100 truncate flex-1 text-sm">{{ displayTitle }}</span>

      <AppBadge :kind="checklist.kind" />

      <span
        v-if="isComplete"
        class="text-green-400 shrink-0 text-base"
        title="All done!"
      >✓</span>

      <!-- Actions -->
      <div class="flex items-center gap-1 shrink-0">
        <AppButton
          v-if="checklist.kind === 'template'"
          variant="primary"
          @click="$emit('run', checklist.id)"
        >
          Run
        </AppButton>
        <AppButton
          v-if="checklist.kind !== 'run'"
          variant="ghost"
          @click="$emit('edit', checklist.id)"
        >
          Edit
        </AppButton>
        <AppButton
          v-if="checklist.kind !== 'template'"
          variant="ghost"
          @click="$emit('archive', checklist.id)"
        >
          Archive
        </AppButton>
        <AppButton variant="danger" @click="$emit('delete', checklist.id)">Delete</AppButton>
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
      <div
        v-for="item in checklist.items"
        :key="item.id"
        class="flex items-center gap-2 py-1 group"
      >
        <input
          type="checkbox"
          :checked="item.done"
          class="accent-violet-500 w-4 h-4 cursor-pointer shrink-0"
          @change="$emit('toggle-item', checklist.id, item.id)"
        />

        <!-- Inline edit input -->
        <input
          v-if="editingItemId === item.id"
          v-focus
          v-model="editingItemText"
          class="bg-transparent border-b border-zinc-700 focus:border-violet-500 outline-none text-zinc-100 text-sm py-0.5 transition-colors flex-1"
          @keydown="onEditItemKeydown"
          @blur="confirmEditItem"
        />

        <!-- Display text (click to edit) -->
        <span
          v-else
          class="text-sm flex-1 cursor-text min-w-0 truncate"
          :class="item.done ? 'line-through text-zinc-600' : 'text-zinc-300'"
          @click="startEditItem(item)"
        >
          {{ item.text }}
        </span>

        <!-- Remove button (visible on group hover) -->
        <button
          class="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all text-xs shrink-0 cursor-pointer"
          @click="$emit('remove-item', checklist.id, item.id)"
        >
          ✕
        </button>
      </div>

      <!-- Inline new-item input -->
      <div v-if="isAddingItem" class="flex items-center gap-2 py-1 mt-1">
        <input
          ref="addItemInputEl"
          v-model="newItemText"
          placeholder="New item…"
          class="bg-transparent border-b border-zinc-700 focus:border-violet-500 outline-none text-zinc-100 text-sm py-0.5 placeholder:text-zinc-600 transition-colors flex-1"
          @keydown="onAddItemKeydown"
          @blur="cancelAddItem"
        />
      </div>

      <button
        v-else
        class="text-xs text-zinc-700 hover:text-zinc-400 transition-colors mt-2"
        @click="startAddItem"
      >
        + Add item
      </button>
    </div>
  </div>
</template>
