<script setup lang="ts">
import { ref } from 'vue'
import VField from '../atoms/VField.vue'
import VButton from '../atoms/VButton.vue'

defineProps<{
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'create', name: string): void
}>()

const newName = ref('')

function confirm(): void {
  if (newName.value.trim()) {
    emit('create', newName.value.trim())
    newName.value = ''
  }
}
</script>

<template>
  <div class="flex mb-4">
    <form @submit.prevent="confirm" class="flex items-center gap-2 justify-end w-full">
      <VField v-model="newName" :placeholder="placeholder ?? 'New checklist'" @blur="confirm" />
      <VButton v-if="newName" variant="primary" type="submit">Create</VButton>
    </form>
  </div>
</template>
