<script setup lang="ts">
import { reactive } from 'vue'
import type { ChecklistItem, ChecklistNode } from '../../types'
import { countDone, countItems } from '../../composables/useTreeHelpers'
import AppCheckbox from '../atoms/AppCheckbox.vue'

// Self-reference: Vue 3 resolves <ChecklistTree> by this file's name automatically.

defineProps<{
  nodes: ChecklistNode[]
  depth?: number
}>()

// The parent owns the mutation so it can react when a toggle completes the checklist.
const emit = defineEmits<{
  'toggle-item': [item: ChecklistItem]
}>()

// Local expand/collapse state — viewing a checklist from a task shouldn't
// persist (and sync) a collapse change on the checklist itself.
const collapsedOverrides = reactive<Record<string, boolean>>({})

function isCollapsed(groupId: string, persisted: boolean): boolean {
  return collapsedOverrides[groupId] ?? persisted
}

function toggleCollapsed(groupId: string, persisted: boolean): void {
  collapsedOverrides[groupId] = !isCollapsed(groupId, persisted)
}
</script>

<template>
  <ul class="flex flex-col" :class="(depth ?? 0) > 0 && 'pl-5 border-l border-hairline ml-1.5'">
    <li v-for="node in nodes" :key="node.id">
      <!-- Item -->
      <div v-if="node.type === 'item'" class="flex items-center gap-2 py-1.5 pl-1">
        <AppCheckbox
          :model-value="node.done"
          @update:model-value="emit('toggle-item', node)"
        />
        <span
          class="flex-1 text-sm wrap-break-word leading-snug"
          :class="node.done ? 'line-through text-fg-4' : 'text-fg-2'"
        >{{ node.text }}</span>
      </div>

      <!-- Group -->
      <template v-else>
        <button
          class="w-full flex items-center gap-1.5 py-1.5 text-left"
          @click="toggleCollapsed(node.id, node.collapsed)"
        >
          <span class="text-fg-3 text-xs w-3 shrink-0">{{ isCollapsed(node.id, node.collapsed) ? '▸' : '▾' }}</span>
          <span class="flex-1 text-xs font-semibold uppercase tracking-wider text-fg-3 truncate">{{ node.title }}</span>
          <span class="shrink-0 text-xs text-fg-4">{{ countDone(node.children) }}/{{ countItems(node.children) }}</span>
        </button>
        <ChecklistTree
          v-if="!isCollapsed(node.id, node.collapsed) && node.children.length"
          :nodes="node.children"
          :depth="(depth ?? 0) + 1"
          @toggle-item="emit('toggle-item', $event)"
        />
      </template>
    </li>
  </ul>
</template>
