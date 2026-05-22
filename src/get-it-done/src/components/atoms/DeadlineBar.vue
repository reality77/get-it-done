<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ deadline: string }>()

const bar = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(props.deadline)
  due.setHours(0, 0, 0, 0)
  const daysBeforeDeadline = Math.ceil((due.getTime() - today.getTime()) / 86400000)
  const width = Math.max(
    1,
    daysBeforeDeadline <= 0
      ? 100
      : daysBeforeDeadline > 90
        ? 1
        : ((90 - daysBeforeDeadline) / 90) * 100
  )

  if (daysBeforeDeadline <= 0)  return { width, color: 'bg-danger' }
  if (daysBeforeDeadline <= 3)  return { width,  color: 'bg-secondary' }
  if (daysBeforeDeadline <= 7)  return { width,  color: 'bg-secondary' }
  if (daysBeforeDeadline <= 14) return { width,  color: 'bg-warning' }
  if (daysBeforeDeadline <= 30) return { width,  color: 'bg-success' }
  if (daysBeforeDeadline <= 90) return { width,  color: 'bg-success' }
  return           { width,  color: 'bg-success' }
})
</script>

<template>
  <div class="h-1 w-full overflow-hidden rounded-lg bg-zinc-900/90">
    <div
      class="h-full rounded-lg transition-all duration-500"
      :class="bar.color"
      :style="{ width: bar.width + '%' }"
    />
  </div>
</template>
