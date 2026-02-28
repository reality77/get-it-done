<script setup lang="ts">
defineProps<{
  label: string
  active: boolean
  count?: number
}>()

defineEmits<{
  (e: 'select'): void
}>()
</script>

<template>
  <button
    class="pb-2.5 text-sm font-medium transition-colors cursor-pointer"
    :class="active ? 'text-white border-b-2 border-violet-500' : 'text-zinc-400 hover:text-zinc-200'"
    @click="$emit('select')"
  >
    {{ label }}
    <span
      v-if="count !== undefined && count > 0"
      class="ml-1.5 text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full"
    >
      {{ count }}
    </span>
  </button>
</template>
