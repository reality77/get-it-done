<script setup lang="ts">
defineProps<{
  modelValue: boolean
  disabled?: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()
</script>

<template>
  <input
    type="checkbox"
    :checked="modelValue"
    :disabled="disabled"
    class="accent-violet-500 w-4 h-4 shrink-0"
    :class="disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
    @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
  />
</template>
