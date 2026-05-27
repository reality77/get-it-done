<script setup lang="ts">
import type { TaskEffort } from '../../types'

defineProps<{ effort: TaskEffort }>()

const letterMap: Record<TaskEffort, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
}

const colorMap: Record<TaskEffort, string> = {
  small: 'bg-success text-white',
  medium: 'bg-info text-white',
  large: 'bg-secondary text-white',
}
</script>

<template>
  <span
    class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0"
    :class="colorMap[effort]"
  >
    {{ letterMap[effort] }}
  </span>
</template>
