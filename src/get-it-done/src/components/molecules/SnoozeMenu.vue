<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { getSnoozeOptions } from '../../composables/useSnoozeOptions'

const emit = defineEmits<{
  (e: 'pick', date: string): void
  (e: 'cancel'): void
}>()

const options = getSnoozeOptions()
const menuEl = ref<HTMLElement | null>(null)

function onClickOutside(event: MouseEvent): void {
  if (menuEl.value && !menuEl.value.contains(event.target as Node)) {
    emit('cancel')
  }
}

onMounted(() => {
  // Defer so the click that opened the menu doesn't immediately close it
  setTimeout(() => document.addEventListener('click', onClickOutside), 0)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div
    ref="menuEl"
    class="bg-bg-1 border border-border rounded-lg shadow-xl py-1 min-w-36"
  >
    <button
      v-for="opt in options"
      :key="opt.date"
      class="w-full text-left px-3 py-1.5 text-sm text-fg-2 hover:bg-bg-2 hover:text-fg transition-colors cursor-pointer"
      @click="$emit('pick', opt.date)"
    >
      {{ opt.label }}
      <span class="text-fg-4 text-xs ml-1">{{ opt.date }}</span>
    </button>
  </div>
</template>
