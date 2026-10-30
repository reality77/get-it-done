<script setup lang="ts">
import VField from '../atoms/VField.vue'
import VButton from '../atoms/VButton.vue'

defineProps<{
  placeholder?: string
  canCreate?: boolean
}>()

const emit = defineEmits<{
  (e: 'create', name: string): void
}>()

const query = defineModel<string>({ default: '' })

function confirm(): void {
  const name = query.value.trim()
  if (name) emit('create', name)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') query.value = ''
}
</script>

<template>
  <form @submit.prevent="canCreate && confirm()" class="flex items-center gap-2 w-full mb-4">
    <VField
      v-model="query"
      type="search"
      :placeholder="placeholder ?? 'Filter checklists…'"
      class="flex-1 min-w-0"
      @keydown="onKeydown"
    />
    <VButton
      v-if="canCreate"
      variant="primary"
      type="submit"
      class="shrink-0"
      :disabled="!query.trim()"
    >
      Create
    </VButton>
  </form>
</template>
