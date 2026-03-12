<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { ChecklistItemGroup } from '../../types'
import { makeKeydownHandler } from '../../composables/useKeyboardConfirm'
import ItemRow from './ItemRow.vue'

// Self-reference: Vue 3 resolves <ItemGroup> by this file's name automatically.

const props = defineProps<{
  group: ChecklistItemGroup
  checklistId: string
  tracked?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-item', checklistId: string, itemId: string): void
  (e: 'update-item-text', checklistId: string, itemId: string, text: string): void
  (e: 'remove-item', checklistId: string, itemId: string): void
  (e: 'add-item', checklistId: string, text: string, groupId: string): void
  (e: 'add-group', checklistId: string, title: string, parentGroupId: string): void
  (e: 'update-group-title', checklistId: string, groupId: string, title: string): void
  (e: 'toggle-group-collapsed', checklistId: string, groupId: string): void
  (e: 'remove-group', checklistId: string, groupId: string): void
}>()

const itemRowRefs = ref<InstanceType<typeof ItemRow>[]>([])

// ── Title editing ─────────────────────────────────────────────────────────────
const isEditingTitle = ref(false)
const editTitleText = ref('')
const editTitleInputEl = ref<HTMLInputElement | null>(null)

async function startEditTitle(): Promise<void> {
  editTitleText.value = props.group.title
  isEditingTitle.value = true
  await nextTick()
  editTitleInputEl.value?.focus()
  editTitleInputEl.value?.select()
}

function confirmEditTitle(): void {
  const title = editTitleText.value.trim()
  if (title) emit('update-group-title', props.checklistId, props.group.id, title)
  isEditingTitle.value = false
}

function cancelEditTitle(): void {
  isEditingTitle.value = false
}

// ── Add item ──────────────────────────────────────────────────────────────────
const isAddingItem = ref(false)
const newItemText = ref('')
const addItemInputEl = ref<HTMLInputElement | null>(null)

async function startAddItem(): Promise<void> {
  itemRowRefs.value.forEach(r => r.cancelEdit())
  if (props.group.collapsed) emit('toggle-group-collapsed', props.checklistId, props.group.id)
  isAddingGroup.value = false
  isAddingItem.value = true
  await nextTick()
  addItemInputEl.value?.focus()
}

function confirmAddItem(): void {
  const text = newItemText.value.trim()
  if (!text) { cancelAddItem(); return }
  emit('add-item', props.checklistId, text, props.group.id)
  newItemText.value = ''
}

function cancelAddItem(): void {
  isAddingItem.value = false
  newItemText.value = ''
}

// ── Add sub-group ─────────────────────────────────────────────────────────────
const isAddingGroup = ref(false)
const newGroupTitle = ref('')
const addGroupInputEl = ref<HTMLInputElement | null>(null)

async function startAddGroup(): Promise<void> {
  if (props.group.collapsed) emit('toggle-group-collapsed', props.checklistId, props.group.id)
  isAddingItem.value = false
  isAddingGroup.value = true
  await nextTick()
  addGroupInputEl.value?.focus()
}

function confirmAddGroup(): void {
  const title = newGroupTitle.value.trim()
  if (!title) { cancelAddGroup(); return }
  emit('add-group', props.checklistId, title, props.group.id)
  newGroupTitle.value = ''
}

function cancelAddGroup(): void {
  isAddingGroup.value = false
  newGroupTitle.value = ''
}

// ── Keyboard helpers ──────────────────────────────────────────────────────────
const onEditTitleKeydown = makeKeydownHandler(confirmEditTitle, cancelEditTitle)
const onAddItemKeydown = makeKeydownHandler(confirmAddItem, cancelAddItem)
const onAddGroupKeydown = makeKeydownHandler(confirmAddGroup, cancelAddGroup)

// ── Stable forwarders for recursive <ItemGroup> events ────────────────────────
function forwardToggleItem(cid: string, iid: string): void { emit('toggle-item', cid, iid) }
function forwardUpdateItemText(cid: string, iid: string, text: string): void { emit('update-item-text', cid, iid, text) }
function forwardRemoveItem(cid: string, iid: string): void { emit('remove-item', cid, iid) }
function forwardAddItem(cid: string, text: string, gid: string): void { emit('add-item', cid, text, gid) }
function forwardAddGroup(cid: string, title: string, pgid: string): void { emit('add-group', cid, title, pgid) }
function forwardUpdateGroupTitle(cid: string, gid: string, title: string): void { emit('update-group-title', cid, gid, title) }
function forwardToggleGroupCollapsed(cid: string, gid: string): void { emit('toggle-group-collapsed', cid, gid) }
function forwardRemoveGroup(cid: string, gid: string): void { emit('remove-group', cid, gid) }
</script>

<template>
  <div class="mt-1">
    <!-- Group header -->
    <div class="flex items-center gap-1.5 py-1 group/header">
      <button
        class="text-zinc-600 hover:text-zinc-300 transition-colors text-xs w-3 shrink-0 text-left"
        @click="emit('toggle-group-collapsed', checklistId, group.id)"
      >
        {{ group.collapsed ? '▸' : '▾' }}
      </button>

      <input
        v-if="isEditingTitle"
        ref="editTitleInputEl"
        v-model="editTitleText"
        class="bg-transparent border-b border-zinc-700 focus:border-violet-500 outline-none text-zinc-200 text-sm py-0 flex-1 font-medium"
        @keydown="onEditTitleKeydown"
        @blur="confirmEditTitle"
      />
      <span
        v-else
        class="text-zinc-400 text-sm font-medium cursor-text select-none flex-1 truncate"
        @click="startEditTitle"
      >
        {{ group.title }}
      </span>

      <button
        class="opacity-0 group-hover/header:opacity-100 text-zinc-600 hover:text-red-400 transition-all text-xs shrink-0 cursor-pointer"
        @click="emit('remove-group', checklistId, group.id)"
      >
        ✕
      </button>
    </div>

    <!-- Children -->
    <div v-if="!group.collapsed" class="pl-4 border-l border-zinc-800 ml-1.5">
      <template v-for="node in group.children" :key="node.id">
        <ItemRow
          v-if="node.type === 'item'"
          ref="itemRowRefs"
          :item="node"
          :tracked="tracked"
          @toggle="emit('toggle-item', checklistId, node.id)"
          @update-text="(text) => emit('update-item-text', checklistId, node.id, text)"
          @remove="emit('remove-item', checklistId, node.id)"
          @start-edit="cancelAddItem"
        />
        <!-- Recursive: Vue resolves <ItemGroup> by this file's name -->
        <ItemGroup
          v-else-if="node.type === 'group'"
          :group="node"
          :checklist-id="checklistId"
          :tracked="tracked"
          @toggle-item="forwardToggleItem"
          @update-item-text="forwardUpdateItemText"
          @remove-item="forwardRemoveItem"
          @add-item="forwardAddItem"
          @add-group="forwardAddGroup"
          @update-group-title="forwardUpdateGroupTitle"
          @toggle-group-collapsed="forwardToggleGroupCollapsed"
          @remove-group="forwardRemoveGroup"
        />
      </template>

      <!-- Inline new-item input -->
      <div v-if="isAddingItem" class="flex items-center gap-2 py-1">
        <input
          ref="addItemInputEl"
          v-model="newItemText"
          placeholder="New item…"
          class="bg-transparent border-b border-zinc-700 focus:border-violet-500 outline-none text-zinc-100 py-0.5 placeholder:text-zinc-600 transition-colors flex-1 text-sm"
          @keydown="onAddItemKeydown"
          @blur="cancelAddItem"
        />
      </div>

      <!-- Inline new-group input -->
      <div v-if="isAddingGroup" class="flex items-center gap-1.5 py-1">
        <input
          ref="addGroupInputEl"
          v-model="newGroupTitle"
          placeholder="Group name…"
          class="bg-transparent border-b border-zinc-700 focus:border-violet-500 outline-none text-zinc-200 py-0.5 placeholder:text-zinc-600 transition-colors flex-1 text-sm font-medium"
          @keydown="onAddGroupKeydown"
          @blur="cancelAddGroup"
        />
      </div>

      <!-- Add buttons -->
      <div v-if="!isAddingItem && !isAddingGroup" class="flex items-center gap-3 mt-1">
        <button
          class="text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
          @click="startAddItem"
        >
          + item
        </button>
        <button
          class="text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
          @click="startAddGroup"
        >
          + group
        </button>
      </div>
    </div>
  </div>
</template>
