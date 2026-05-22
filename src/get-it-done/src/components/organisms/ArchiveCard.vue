<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Checklist, ChecklistItem, ChecklistNode } from '../../types'
import KindBadge from '../molecules/KindBadge.vue'
import VButton from '../atoms/VButton.vue'

const props = defineProps<{
  checklist: Checklist
}>()

defineEmits<{
  (e: 'unarchive', checklistId: string): void
  (e: 'delete', checklistId: string): void
}>()

const isExpanded = ref(false)

function flattenItems(nodes: ChecklistNode[]): ChecklistItem[] {
  const result: ChecklistItem[] = []
  for (const node of nodes) {
    if (node.type === 'item') result.push(node)
    else result.push(...flattenItems(node.children))
  }
  return result
}

const allItems = computed(() => flattenItems(props.checklist.items))

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="bg-bg-1/50 border border-hairline/60 rounded-xl p-4">
    <!-- Header -->
    <div class="flex items-center gap-2 min-w-0">
      <button
        class="text-fg-4 hover:text-fg-3 transition-colors w-4 shrink-0 text-left"
        @click="isExpanded = !isExpanded"
      >
        {{ isExpanded ? '▾' : '▸' }}
      </button>

      <span class="text-fg-4 truncate flex-1">
        {{ checklist.runLabel ?? checklist.title }}
      </span>

      <KindBadge :kind="checklist.kind" />

      <span v-if="checklist.archivedAt" class="text-fg-4 shrink-0">
        {{ formatDate(checklist.archivedAt) }}
      </span>

      <div class="flex items-center gap-1 shrink-0">
        <VButton variant="ghost" @click="$emit('unarchive', checklist.id)">Restore</VButton>
        <VButton variant="danger" @click="$emit('delete', checklist.id)">Delete</VButton>
      </div>
    </div>

    <!-- Body (collapsed by default) -->
    <div v-if="isExpanded && allItems.length > 0" class="mt-3 pl-5 space-y-1">
      <div
        v-for="item in allItems"
        :key="item.id"
        class="flex items-center gap-2 py-0.5"
      >
        <input
          type="checkbox"
          :checked="item.done"
          disabled
          class="accent-primary w-4 h-4 shrink-0 opacity-40 cursor-not-allowed"
        />
        <span
          class="text-fg-4"
          :class="item.done ? 'line-through' : ''"
        >
          {{ item.text }}
        </span>
      </div>
    </div>
  </div>
</template>
