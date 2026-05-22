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
    :class="active ? 'text-white border-b-2 border-primary' : 'text-fg-3 hover:text-fg'"
    @click="$emit('select')"
  >
    {{ label }}
    <span
      v-if="count !== undefined && count > 0"
      class="ml-1.5 text-xs bg-bg-2 text-fg-3 px-1.5 py-0.5 rounded-full"
    >
      {{ count }}
    </span>
    <span
      v-if="dot"
      class="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle"
    />
  </button>
</template>
