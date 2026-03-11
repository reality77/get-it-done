<script setup lang="ts">
import type { Checklist } from '../../types'
import ChecklistCard from '../organisms/ChecklistCard.vue'
import ChecklistCreationForm from '../molecules/ChecklistCreationForm.vue'

defineProps<{
  checklists: Checklist[]
  focusChecklistId?: string | null
}>()

defineEmits<{
  (e: 'edit', checklistId: string): void
  (e: 'delete', checklistId: string): void
  (e: 'archive', checklistId: string): void
  (e: 'create', checklistName: string): void
}>()
</script>

<template>
  <div>
    <ChecklistCreationForm placeholder="New checklist" @create="(name) => $emit('create', name)" />

    <p v-if="checklists.length === 0" class="text-center text-zinc-600 py-12">
      No active checklists. Create one to get started.
    </p>

    <div v-else class="space-y-3">
      <ChecklistCard
        v-for="checklist in checklists"
        :key="checklist.id"
        :checklist="checklist"
        :auto-focus-add-item="focusChecklistId === checklist.id"
        @edit="(cId: string) => $emit('edit', cId)"
        @delete="(cId: string) => $emit('delete', cId)"
        @archive="(cId: string) => $emit('archive', cId)"
      />
    </div>
  </div>
</template>
