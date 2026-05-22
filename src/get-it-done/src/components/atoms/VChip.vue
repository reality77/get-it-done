<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const classes = computed(() => [
  'inline-flex items-center gap-2 h-[34px] px-3.5 rounded-full',
  'border text-[13px] font-medium transition-[background-color,border-color,color] duration-150',
  'cursor-pointer',
  props.modelValue
    ? 'bg-fg text-bg-0 border-transparent'
    : 'bg-bg-1 text-fg-2 border-border hover:bg-bg-2',
  props.disabled && 'opacity-50 cursor-not-allowed',
])
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    :class="classes"
    @click="emit('update:modelValue', !modelValue)"
  >
    <svg v-if="modelValue" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5 L4 7 L8 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <slot />
  </button>
</template>
