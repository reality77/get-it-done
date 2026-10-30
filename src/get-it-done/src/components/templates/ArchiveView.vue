<script setup lang="ts">
import type { Checklist } from '../../types'
import ArchiveCard from '../organisms/ArchiveCard.vue'

defineProps<{
  checklists: Checklist[]
  expandedIds?: Set<string>
  filtering?: boolean
}>()

defineEmits<{
  (e: 'unarchive', checklistId: string): void
  (e: 'delete', checklistId: string): void
}>()
</script>

<template>
  <div>
    <p v-if="checklists.length === 0 && filtering" class="text-center text-fg-4 py-12">
      No match.
    </p>

    <p v-else-if="checklists.length === 0" class="text-center text-fg-4 py-12">
      Nothing archived yet.
    </p>

    <div v-else class="space-y-3">
      <ArchiveCard
        v-for="checklist in checklists"
        :key="checklist.id"
        :checklist="checklist"
        :force-expanded="expandedIds?.has(checklist.id) ?? false"
        @unarchive="(cId) => $emit('unarchive', cId)"
        @delete="(cId) => $emit('delete', cId)"
      />
    </div>
  </div>
</template>
