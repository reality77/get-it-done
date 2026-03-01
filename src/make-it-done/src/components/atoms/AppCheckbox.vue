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
  <label
    class="flex items-center justify-center w-11 h-11 -mx-3 -my-3 shrink-0"
    :class="disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
  >
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="accent-violet-500 w-4 h-4 pointer-events-none"
      :class="disabled ? 'opacity-50' : ''"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
  </label>
</template>
