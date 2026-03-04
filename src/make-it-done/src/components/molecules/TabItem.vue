<script setup lang="ts">
defineProps<{
  label: string
  active: boolean
  count?: number
  dot?: boolean
}>()

defineEmits<{
  (e: 'select'): void
}>()
</script>

<template>
  <button
    class="pb-2.5 font-medium transition-colors cursor-pointer"
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
    <span
      v-if="dot"
      class="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-violet-400 align-middle"
    />
  </button>
</template>
