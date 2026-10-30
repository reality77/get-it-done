<script setup lang="ts">
import type { Checklist } from '../../types'
import ChecklistCard from '../organisms/ChecklistCard.vue'
import ArchiveCard from '../organisms/ArchiveCard.vue'

defineProps<{
  checklists: Checklist[]
  /** Archived checklists to list below the active ones (empty when hidden) */
  archived?: Checklist[]
  focusChecklistId?: string | null
  expandedIds?: Set<string>
  filtering?: boolean
}>()

defineEmits<{
  (e: 'edit', checklistId: string): void
  (e: 'delete', checklistId: string): void
  (e: 'archive', checklistId: string): void
  (e: 'unarchive', checklistId: string): void
}>()
</script>

<template>
  <div>
    <p v-if="checklists.length === 0 && !archived?.length && filtering" class="text-center text-fg-4 py-12">
      No match.
    </p>

    <p v-else-if="checklists.length === 0 && !archived?.length" class="text-center text-fg-4 py-12">
      No active checklists. Create one to get started.
    </p>

    <div v-if="checklists.length" class="space-y-3">
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

    <template v-if="archived?.length">
      <p class="text-xs font-medium uppercase tracking-wide text-fg-4 mt-6 mb-2">Archived</p>
      <div class="space-y-3">
        <ArchiveCard
          v-for="checklist in archived"
          :key="checklist.id"
          :checklist="checklist"
          :force-expanded="expandedIds?.has(checklist.id) ?? false"
          @unarchive="(cId) => $emit('unarchive', cId)"
          @delete="(cId) => $emit('delete', cId)"
        />
      </div>
    </template>
  </div>
</template>
