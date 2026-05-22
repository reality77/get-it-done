<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue?: string | number
  label?: string
  placeholder?: string
  type?: string
  error?: string
  hint?: string
  autofocus?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur'): void
  (e: 'keydown', event: KeyboardEvent): void
}>()

const inputClasses = computed(() => [
  'w-full h-12 px-4 rounded-3 text-[15px] font-medium text-fg bg-bg-1',
  'border outline-none transition-[border-color,background-color,box-shadow] duration-150',
  'placeholder:text-fg-4 placeholder:font-normal',
  props.error
    ? 'border-danger focus:border-danger focus:bg-bg-2 focus:shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-danger)_22%,transparent)]'
    : 'border-border focus:border-primary focus:bg-bg-2 focus:shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_18%,transparent)]',
])
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label
      v-if="label"
      class="text-xs font-medium text-fg-3 tracking-wide"
    >
      {{ label }}
    </label>
    <input
      :type="type ?? 'text'"
      :value="modelValue"
      :placeholder="placeholder"
      :autofocus="autofocus"
      :aria-invalid="!!error"
      :class="inputClasses"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="emit('blur')"
      @keydown="emit('keydown', $event)"
    />
    <p
      v-if="error || hint"
      class="text-xs"
      :class="error ? 'text-danger' : 'text-fg-3'"
    >
      {{ error || hint }}
    </p>
  </div>
</template>
