<script setup lang="ts">
import type { TaskPriority } from '../../types'
import VBadge from '../atoms/VBadge.vue'

const props = defineProps<{
  priority: TaskPriority
  compact?: boolean
}>()

const variantMap: Record<TaskPriority, 'danger' | 'warning' | 'neutral'> = {
  urgent:    'danger',
  important: 'warning',
  secondary: 'neutral',
}

const iconMap: Record<TaskPriority, string> = {
  urgent:    '🔴',
  important: '🟡',
  secondary: '⚪',
}
</script>

<template>
  <VBadge :variant="variantMap[props.priority]">
    <span v-if="!props.compact">{{ props.priority }}</span>
    <template v-else>
      <span class="sm:hidden">{{ iconMap[props.priority] }}</span>
      <span class="hidden sm:inline">{{ props.priority }}</span>
    </template>
  </VBadge>
</template>
