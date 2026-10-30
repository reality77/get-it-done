<script setup lang="ts">
import type { Checklist } from '../../types'
import ChecklistCard from '../organisms/ChecklistCard.vue'

defineProps<{
  templates: Checklist[]
  focusChecklistId?: string | null
  expandedIds?: Set<string>
  filtering?: boolean
}>()

defineEmits<{
  (e: 'edit', checklistId: string): void
  (e: 'delete', checklistId: string): void
  (e: 'run', checklistId: string): void
}>()
</script>

<template>
  <div>
    <p v-if="templates.length === 0 && filtering" class="text-center text-fg-4 py-12">
      No match.
    </p>

    <p v-else-if="templates.length === 0" class="text-center text-fg-4 py-12">
      No templates yet. Create one to reuse a checklist multiple times.
    </p>

    <div v-else class="space-y-3">
      <ChecklistCard
        v-for="template in templates"
        :key="template.id"
        :checklist="template"
        :force-expanded="expandedIds?.has(template.id) ?? false"
        :auto-focus-add-item="focusChecklistId === template.id"
        @edit="(cId: string) => $emit('edit', cId)"
        @delete="(cId: string) => $emit('delete', cId)"
        @run="(cId: string) => $emit('run', cId)"
      />
    </div>
  </div>
</template>
