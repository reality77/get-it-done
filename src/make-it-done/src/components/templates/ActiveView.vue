<script setup lang="ts">
import type { Checklist } from '../../types'
import ChecklistCard from '../organisms/ChecklistCard.vue'
import AppButton from '../atoms/AppButton.vue'
import AppInput from '../atoms/AppInput.vue';
import { ref } from 'vue';

defineProps<{
  checklists: Checklist[]
  focusChecklistId?: string | null
}>()

const emit = defineEmits<{
  (e: 'edit', checklistId: string): void
  (e: 'delete', checklistId: string): void
  (e: 'archive', checklistId: string): void
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
        placeholder="New checklist"
        @blur="confirmNewChecklist">
      </AppInput>

      <AppButton v-if="newChecklistName" variant="primary" type="submit">Create</AppButton>
      </form>
    </div>

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
