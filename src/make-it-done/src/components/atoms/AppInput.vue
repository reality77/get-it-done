<script setup lang="ts">
defineProps<{
  modelValue: string
  placeholder?: string
  autofocus?: boolean
  type?: 'text' | 'password'
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur'): void
  (e: 'keydown', event: KeyboardEvent): void
}>()
</script>

<template>
  <input
    :type="type ?? 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :autofocus="autofocus"
    class="bg-transparent border-b border-zinc-700 focus:border-violet-500 outline-none text-zinc-100 w-full py-0.5 placeholder:text-zinc-600 transition-colors"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    @blur="$emit('blur')"
    @keydown="$emit('keydown', $event)"
  />
</template>
