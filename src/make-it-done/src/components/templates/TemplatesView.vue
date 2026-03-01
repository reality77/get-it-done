<script setup lang="ts">
import type { Checklist } from '../../types'
import ChecklistCard from '../organisms/ChecklistCard.vue'
import AppButton from '../atoms/AppButton.vue'

defineProps<{
  templates: Checklist[]
  focusChecklistId?: string | null
}>()

defineEmits<{
  (e: 'edit', checklistId: string): void
  (e: 'delete', checklistId: string): void
  (e: 'run', checklistId: string): void
  (e: 'create'): void
}>()
</script>

<template>
  <div>
    <div class="flex justify-end mb-4">
      <AppButton variant="primary" @click="$emit('create')">+ New Template</AppButton>
    </div>

    <p v-if="templates.length === 0" class="text-center text-zinc-600 py-12">
      No templates yet. Create one to reuse a checklist multiple times.
    </p>

    <div v-else class="space-y-3">
      <ChecklistCard
        v-for="template in templates"
        :key="template.id"
        :checklist="template"
        :auto-focus-add-item="focusChecklistId === template.id"
        @edit="(cId) => $emit('edit', cId)"
        @delete="(cId) => $emit('delete', cId)"
        @run="(cId) => $emit('run', cId)"
      />
    </div>
  </div>
</template>
