<script setup lang="ts">
import type { ChecklistKind } from '../../types'

defineProps<{
  kind: ChecklistKind
}>()
</script>

<template>
  <span
    class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
    :class="{
      'bg-zinc-800 text-zinc-400': kind === 'one-time',
      'bg-violet-900/40 text-violet-300': kind === 'template',
      'bg-blue-900/40 text-blue-300': kind === 'run',
    }"
  >
    {{ kind }}
  </span>
</template>
