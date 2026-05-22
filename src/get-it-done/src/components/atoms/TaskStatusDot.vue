<script setup lang="ts">
import type { TaskStatus } from '../../types'

defineProps<{
  status: TaskStatus
}>()
</script>

<template>
  <span
    class="inline-block w-2 h-2 rounded-full shrink-0"
    :class="{
      'bg-danger':    status === 'active',
      'bg-warning': status === 'snoozed',
      'bg-fg-4':   status === 'someday',
    }"
  />
</template>
