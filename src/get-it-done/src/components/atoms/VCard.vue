<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  elevated?: boolean
  as?: string
}>()

const classes = computed(() => [
  'rounded-4 border',
  props.elevated
    ? 'bg-bg-2 border-hairline shadow-[0_1px_0_oklch(0.55_0.018_55_/_0.6)_inset,0_10px_28px_-10px_rgba(0,0,0,0.55)]'
    : 'bg-bg-1 border-hairline shadow-[0_1px_0_oklch(0.52_0.016_55_/_0.55)_inset,0_1px_2px_rgba(0,0,0,0.35)]',
])
</script>

<template>
  <component :is="as ?? 'div'" :class="classes">
    <slot />
  </component>
</template>
