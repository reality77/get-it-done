<script setup lang="ts">
import type { TaskPriority } from '../../types'
import VBadge from '../atoms/VBadge.vue'

defineProps<{
  priority: TaskPriority
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
  <VBadge :variant="variantMap[priority]">
    <span class="sm:hidden">{{ iconMap[priority] }}</span>
    <span class="hidden sm:inline">{{ priority }}</span>
  </VBadge>
</template>
