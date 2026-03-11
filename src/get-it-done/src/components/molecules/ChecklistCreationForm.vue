<script setup lang="ts">
import { ref } from 'vue'
import AppInput from '../atoms/AppInput.vue'
import AppButton from '../atoms/AppButton.vue'

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
      <AppInput v-model="newName" :placeholder="placeholder ?? 'New checklist'" @blur="confirm" />
      <AppButton v-if="newName" variant="primary" type="submit">Create</AppButton>
    </form>
  </div>
</template>
