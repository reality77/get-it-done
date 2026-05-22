<script setup lang="ts">
import { computed } from 'vue'
import VButton from '../atoms/VButton.vue'

const props = withDefaults(defineProps<{
  selectedCount: number
  completedCount?: number
  maxCount?: number
}>(), {
  completedCount: 0,
  maxCount: 5,
})

defineEmits<{
  (e: 'suggest'): void
  (e: 'clear'): void
}>()

const remaining = computed(() => Math.max(0, props.selectedCount - props.completedCount))
const completedPct = computed(() => Math.min((props.completedCount / props.maxCount) * 100, 100))
const remainingPct = computed(() =>
  Math.min(((props.selectedCount - props.completedCount) / props.maxCount) * 100, 100 - completedPct.value)
)
</script>

<template>
  <div class="flex items-center gap-3 mb-4">
    <span class="text-sm text-fg-3 shrink-0">
      Today:
      <span class="font-semibold text-success">✓ {{ completedCount }}</span>
      <span class="text-fg-4"> · </span>
      <span
        class="font-semibold"
        :class="selectedCount >= maxCount ? 'text-primary' : 'text-fg'"
      >{{ remaining }}</span>
      <span class="text-fg-4"> / {{ maxCount }}</span>
    </span>
    <div class="flex-1 h-1 bg-bg-2 rounded-full overflow-hidden flex">
      <div
        class="h-full bg-success transition-all"
        :style="{ width: `${completedPct}%` }"
      />
      <div
        class="h-full bg-primary transition-all"
        :style="{ width: `${remainingPct}%` }"
      />
    </div>
    <VButton variant="primary" @click="$emit('suggest')">Suggest</VButton>
    <VButton variant="ghost" @click="$emit('clear')">Clear</VButton>
  </div>
</template>
