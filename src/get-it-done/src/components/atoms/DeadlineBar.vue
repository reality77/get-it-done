<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ deadline: string }>()

const bar = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(props.deadline)
  due.setHours(0, 0, 0, 0)
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000)

  if (days <= 0)  return { width: 100, color: 'bg-red-600' }
  if (days <= 3)  return { width: 90,  color: 'bg-orange-500' }
  if (days <= 7)  return { width: 75,  color: 'bg-orange-400' }
  if (days <= 14) return { width: 50,  color: 'bg-yellow-400' }
  return           { width: 25,  color: 'bg-emerald-500' }
})
</script>

<template>
  <div
    class="absolute bottom-0 left-0 h-0.5 transition-all duration-500"
    :class="bar.color"
    :style="{ width: bar.width + '%' }"
  />
</template>
