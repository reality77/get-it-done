<script setup lang="ts">
import type { ChecklistKind } from '../../types'
import VBadge from '../atoms/VBadge.vue'

defineProps<{
  kind: ChecklistKind
}>()

const variantMap: Record<ChecklistKind, 'neutral' | 'primary' | 'info'> = {
  'one-time': 'neutral',
  'template': 'primary',
  'run':      'info',
}
</script>

<template>
  <VBadge :variant="variantMap[kind]">{{ kind }}</VBadge>
</template>
