<script setup lang="ts">
import AppButton from '../atoms/AppButton.vue'

withDefaults(defineProps<{
  selectedCount: number
  maxCount?: number
}>(), {
  maxCount: 5,
})

defineEmits<{
  (e: 'suggest'): void
  (e: 'clear'): void
}>()
</script>

<template>
  <div class="flex items-center gap-3 mb-4">
    <span class="text-sm text-zinc-400">
      Today:
      <span
        class="font-semibold"
        :class="selectedCount >= maxCount ? 'text-violet-400' : 'text-zinc-200'"
      >
        {{ selectedCount }}
      </span>
      <span class="text-zinc-600"> / {{ maxCount }}</span>
    </span>
    <div class="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
      <div
        class="h-full bg-violet-600 rounded-full transition-all"
        :style="{ width: `${Math.min((selectedCount / maxCount) * 100, 100)}%` }"
      />
    </div>
    <AppButton variant="secondary" @click="$emit('suggest')">Suggest</AppButton>
    <AppButton variant="ghost" @click="$emit('clear')">Clear</AppButton>
  </div>
</template>
