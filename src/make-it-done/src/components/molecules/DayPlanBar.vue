<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '../atoms/AppButton.vue'

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
    <span class="text-sm text-zinc-400 shrink-0">
      Today:
      <span class="font-semibold text-emerald-400">✓ {{ completedCount }}</span>
      <span class="text-zinc-600"> · </span>
      <span
        class="font-semibold"
        :class="selectedCount >= maxCount ? 'text-violet-400' : 'text-zinc-200'"
      >{{ remaining }}</span>
      <span class="text-zinc-600"> / {{ maxCount }}</span>
    </span>
    <div class="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden flex">
      <div
        class="h-full bg-emerald-500 transition-all"
        :style="{ width: `${completedPct}%` }"
      />
      <div
        class="h-full bg-violet-600 transition-all"
        :style="{ width: `${remainingPct}%` }"
      />
    </div>
    <AppButton variant="secondary" @click="$emit('suggest')">Suggest</AppButton>
    <AppButton variant="ghost" @click="$emit('clear')">Clear</AppButton>
  </div>
</template>
