<script setup lang="ts">
import type { TaskEffort } from '../../types'
import VBadge from '../atoms/VBadge.vue'

defineProps<{
  effort: TaskEffort
}>()

const variantMap: Record<TaskEffort, 'success' | 'info' | 'secondary'> = {
  small:  'success',
  medium: 'info',
  large:  'secondary',
}

const iconMap: Record<TaskEffort, string> = {
  small:  'S',
  medium: 'M',
  large:  'L',
}
</script>

<template>
  <VBadge :variant="variantMap[effort]">
    <span class="sm:hidden">{{ iconMap[effort] }}</span>
    <span class="hidden sm:inline">{{ effort }}</span>
  </VBadge>
</template>
