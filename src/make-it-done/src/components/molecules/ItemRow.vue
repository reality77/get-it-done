<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSwipe } from '@vueuse/core'
import type { ChecklistItem } from '../../types'
import AppCheckbox from '../atoms/AppCheckbox.vue'

const props = defineProps<{
  item: ChecklistItem
  tracked?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'update-text', text: string): void
  (e: 'remove'): void
  (e: 'start-edit'): void
}>()

const isEditing = ref(false)
const editText = ref('')

const vFocus = {
  mounted(el: Element) {
    const input = el as HTMLInputElement
    input.focus()
    input.select()
  },
}

function startEdit(): void {
  isEditing.value = true
  editText.value = props.item.text
  emit('start-edit')
}

function confirmEdit(): void {
  const text = editText.value.trim()
  if (text) emit('update-text', text)
  isEditing.value = false
  editText.value = ''
}

function cancelEdit(): void {
  isEditing.value = false
  editText.value = ''
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') { e.preventDefault(); confirmEdit() }
  else if (e.key === 'Escape') { cancelEdit() }
}

defineExpose({ cancelEdit })

// ── Swipe-to-delete ──────────────────────────────────────────────────────────
const rowEl = ref<HTMLElement | null>(null)
const swipeOffset = ref(0)
const DELETE_THRESHOLD = 80 // px

const { isSwiping, direction, lengthX } = useSwipe(rowEl, {
  threshold: 10,
  onSwipe() {
    if (isEditing.value) return
    if (direction.value === 'right') {
      swipeOffset.value = Math.min(-lengthX.value, DELETE_THRESHOLD * 1.3)
    }
  },
  onSwipeEnd() {
    if (swipeOffset.value >= DELETE_THRESHOLD) {
      emit('remove')
    }
    swipeOffset.value = 0
  },
})

const rowStyle = computed(() =>
  swipeOffset.value > 0 ? { transform: `translateX(${swipeOffset.value}px)` } : {}
)
const deleteProgress = computed(() =>
  Math.min(swipeOffset.value / DELETE_THRESHOLD, 1)
)
</script>

<template>
  <div ref="rowEl" class="relative overflow-hidden rounded">
    <!-- Red delete hint revealed as item slides right -->
    <div
      class="absolute inset-0 bg-red-400 flex items-center px-3 pointer-events-none"
      :style="{ opacity: deleteProgress * 0.85 }"
    >
      <span class="text-white text-xs font-medium">Delete</span>
    </div>

    <!-- Sliding content layer -->
    <div
      class="flex items-center gap-2 py-1 group relative"
      :class="!isSwiping ? 'transition-transform duration-200' : ''"
      :style="rowStyle"
    >
      <AppCheckbox :model-value="item.done" @update:model-value="$emit('toggle')" />

      <input
        v-if="isEditing"
        v-focus
        v-model="editText"
        class="bg-transparent border-b border-zinc-700 focus:border-violet-500 outline-none text-zinc-100 text-sm py-0.5 transition-colors flex-1"
        @keydown="onKeydown"
        @blur="confirmEdit"
      />

      <span
        v-else
        class="flex-1 cursor-text min-w-0 truncate"
        :class="item.done ? 'line-through text-zinc-600' : 'text-zinc-300'"
        @click="startEdit"
      >
        {{ item.text }}
      </span>

      <!-- Task badges (tracked items only) -->
      <template v-if="tracked && !item.done">
        <span
          v-if="item.status === 'snoozed'"
          class="text-[10px] px-1 py-0.5 rounded bg-yellow-950 text-yellow-400 shrink-0"
          title="Snoozed"
        >💤</span>
        <span
          v-if="item.status === 'someday'"
          class="text-[10px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0"
          title="Someday"
        >☁</span>
        <span
          v-if="item.selectedForToday"
          class="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0"
          title="Selected for today"
        />
      </template>

      <button
        class="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all text-xs shrink-0 cursor-pointer hidden sm:block"
        @click="$emit('remove')"
      >
        ✕
      </button>
    </div>
  </div>
</template>
