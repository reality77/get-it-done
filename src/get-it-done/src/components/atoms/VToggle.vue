<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const toggle = () => {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}

const trackClasses = computed(() => [
  'relative w-[52px] h-[30px] rounded-full border transition-colors duration-200',
  'flex-shrink-0 cursor-pointer',
  props.modelValue ? 'bg-primary border-transparent' : 'bg-bg-2 border-border',
  props.disabled && 'opacity-50 cursor-not-allowed',
])

const thumbClasses = computed(() => [
  'absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full',
  'transition-[transform,background-color] duration-200',
  props.modelValue ? 'translate-x-[22px] bg-fg-on-primary' : 'translate-x-0 bg-fg',
])
</script>

<template>
  <div class="flex items-center justify-between gap-3">
    <span v-if="label" class="text-sm font-medium text-fg-2">{{ label }}</span>
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      :class="trackClasses"
      @click="toggle"
    >
      <span :class="thumbClasses" />
    </button>
  </div>
</template>
