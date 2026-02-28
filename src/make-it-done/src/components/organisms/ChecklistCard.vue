<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { Checklist } from '../../types'
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
const isAddingItem = ref(false)
const newItemText = ref('')
const addItemInputEl = ref<HTMLInputElement | null>(null)

const displayTitle = computed(() => props.checklist.runLabel ?? props.checklist.title)
const doneCount = computed(() => props.checklist.items.filter(i => i.done).length)

async function startAddItem(): Promise<void> {
  isExpanded.value = true
  isAddingItem.value = true
  await nextTick()
  addItemInputEl.value?.focus()
}

function confirmAddItem(): void {
  const text = newItemText.value.trim()
  if (!text) {
    cancelAddItem()
    return
  }
  emit('add-item', props.checklist.id, text)
  newItemText.value = ''
}

function cancelAddItem(): void {
  isAddingItem.value = false
  newItemText.value = ''
}

function onAddItemKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    e.preventDefault()
    confirmAddItem()
  } else if (e.key === 'Escape') {
    cancelAddItem()
  }
}
</script>

<template>
  <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
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
        v-if="checklist.kind !== 'template' && checklist.items.length > 0"
        class="text-xs text-zinc-600 shrink-0"
      >
        {{ doneCount }}/{{ checklist.items.length }}
      </span>

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
        <span
          class="text-sm flex-1"
          :class="item.done ? 'line-through text-zinc-600' : 'text-zinc-300'"
        >
          {{ item.text }}
        </span>
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
