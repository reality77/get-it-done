<script setup lang="ts">
import type { TaskPriority } from '../../types'
import AppBadge from '../atoms/AppBadge.vue'

defineProps<{
  priority: TaskPriority
}>()

const colorMap: Record<TaskPriority, string> = {
  urgent:    'text-red-400 bg-red-950',
  important: 'text-yellow-400 bg-yellow-950',
  secondary: 'text-zinc-400 bg-zinc-800',
}

const iconMap: Record<TaskPriority, string> = {
  urgent:    '🔴',
  important: '🟡',
  secondary: '⚪',
}
</script>

<template>
  <AppBadge :class="colorMap[priority]">
    <span class="sm:hidden">{{ iconMap[priority] }}</span>
    <span class="hidden sm:inline">{{ priority }}</span>
  </AppBadge>
</template>
