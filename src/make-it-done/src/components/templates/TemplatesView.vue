<script setup lang="ts">
import type { Checklist } from '../../types'
import ChecklistCard from '../organisms/ChecklistCard.vue'
import AppButton from '../atoms/AppButton.vue'
import { ref } from 'vue';
import AppInput from '../atoms/AppInput.vue';

defineProps<{
  templates: Checklist[]
  focusChecklistId?: string | null
}>()

const emit = defineEmits<{
  (e: 'edit', checklistId: string): void
  (e: 'delete', checklistId: string): void
  (e: 'run', checklistId: string): void
  (e: 'create', checklistName: string): void
}>()

const newChecklistName = ref('')

function confirmNewChecklist(): void {
  if (newChecklistName.value.trim()) {
    emit('create', newChecklistName.value.trim())
    newChecklistName.value = ''
  }
}

</script>

<template>
  <div>
    <div class="flex mb-4">
      <form @submit.prevent="confirmNewChecklist" class="flex items-center gap-2 justify-end w-full">
      <AppInput
        v-model="newChecklistName"
        placeholder="New checklist template"
        @blur="confirmNewChecklist">
      </AppInput>

      <AppButton v-if="newChecklistName" variant="primary" type="submit">Create</AppButton>
      </form>
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
        @edit="(id: string) => $emit('edit', id)"
        @delete="(id: string) => $emit('delete', id)"
        @run="(id: string) => $emit('run', id)"
      />
    </div>
  </div>
</template>
