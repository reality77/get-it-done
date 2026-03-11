<script setup lang="ts">
import { ref } from 'vue'
import type { ChecklistItem } from '../../types'
import { useSwipeAction } from '../../composables/useSwipeAction'
import { useEditableField } from '../../composables/useEditableField'
import { makeKeydownHandler } from '../../composables/useKeyboardConfirm'
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

const { isEditing, editText, startEdit: _startEdit, confirmEdit, cancelEdit } = useEditableField(
  () => props.item.text,
  (text) => emit('update-text', text),
)

function startEdit(): void {
  _startEdit()
  emit('start-edit')
}

const onKeydown = makeKeydownHandler(confirmEdit, cancelEdit)

defineExpose({ cancelEdit })

// ── Swipe-to-delete ──────────────────────────────────────────────────────────
const rowEl = ref<HTMLElement | null>(null)

const { isSwiping, style: rowStyle, leftProgress: deleteProgress } = useSwipeAction(rowEl, {
  threshold: 80,
  guard: () => !isEditing.value,
  onLeft: () => emit('remove'),
})
</script>

<template>
  <div ref="rowEl" class="relative overflow-hidden rounded">
    <!-- Red delete hint revealed as item slides left -->
    <div
      class="absolute inset-0 bg-red-400 flex items-center justify-end px-3 pointer-events-none"
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
        class="flex-1 cursor-text min-w-0 break-words"
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
