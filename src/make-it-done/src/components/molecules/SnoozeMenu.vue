<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { getSnoozeOptions } from '../../stores/tasks'

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
    class="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-36"
  >
    <button
      v-for="opt in options"
      :key="opt.date"
      class="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
      @click="$emit('pick', opt.date)"
    >
      {{ opt.label }}
      <span class="text-zinc-500 text-xs ml-1">{{ opt.date }}</span>
    </button>
  </div>
</template>
