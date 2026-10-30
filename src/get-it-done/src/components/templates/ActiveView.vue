<script setup lang="ts">
import type { Checklist } from '../../types'
import ChecklistCard from '../organisms/ChecklistCard.vue'

defineProps<{
  checklists: Checklist[]
  focusChecklistId?: string | null
  expandedIds?: Set<string>
  filtering?: boolean
}>()

defineEmits<{
  (e: 'edit', checklistId: string): void
  (e: 'delete', checklistId: string): void
  (e: 'archive', checklistId: string): void
}>()
</script>

<template>
  <div>
    <p v-if="checklists.length === 0 && filtering" class="text-center text-fg-4 py-12">
      No match.
    </p>

    <p v-else-if="checklists.length === 0" class="text-center text-fg-4 py-12">
      No active checklists. Create one to get started.
    </p>

    <div v-else class="space-y-3">
      <ChecklistCard
        v-for="checklist in checklists"
        :key="checklist.id"
        :checklist="checklist"
        :force-expanded="expandedIds?.has(checklist.id) ?? false"
        :auto-focus-add-item="focusChecklistId === checklist.id"
        @edit="(cId: string) => $emit('edit', cId)"
        @delete="(cId: string) => $emit('delete', cId)"
        @archive="(cId: string) => $emit('archive', cId)"
      />
    </div>
  </div>
</template>
