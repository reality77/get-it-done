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
      'bg-red-500':    status === 'active',
      'bg-yellow-500': status === 'snoozed',
      'bg-zinc-500':   status === 'someday',
    }"
  />
</template>
