<script setup lang="ts">
defineProps<{
  variant: 'primary' | 'ghost' | 'danger' | 'icon'
  type?: 'button' | 'submit'
  disabled?: boolean
}>()
</script>

<template>
  <button
    :type="type ?? 'button'"
    :disabled="disabled"
    :class="[
      'transition-colors cursor-pointer',
      variant === 'primary' && 'bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed',
      variant === 'ghost' && 'text-zinc-400 hover:text-zinc-100 text-sm',
      variant === 'danger' && 'text-zinc-500 hover:text-red-400 text-sm',
      variant === 'icon' && 'text-zinc-500 hover:text-zinc-200 p-1 rounded',
    ]"
  >
    <slot />
  </button>
</template>
