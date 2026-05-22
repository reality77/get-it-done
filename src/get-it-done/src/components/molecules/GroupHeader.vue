<script setup lang="ts">
import { useEditableField } from '../../composables/useEditableField'
import { makeKeydownHandler } from '../../composables/useKeyboardConfirm'

const props = defineProps<{
  title: string
  collapsed: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-collapsed'): void
  (e: 'update-title', title: string): void
  (e: 'remove'): void
}>()

const { isEditing, editText, startEdit, confirmEdit, cancelEdit } = useEditableField(
  () => props.title,
  (title) => emit('update-title', title),
)

const onKeydown = makeKeydownHandler(confirmEdit, cancelEdit)
</script>

<template>
  <div class="flex items-center gap-1.5 py-1 group/header">
    <button
      class="text-fg-3 hover:text-fg-2 transition-colors text-xs w-3 shrink-0 text-left"
      @click="emit('toggle-collapsed')"
    >
      {{ collapsed ? '▸' : '▾' }}
    </button>

    <input
      v-if="isEditing"
      v-focus
      v-model="editText"
      class="bg-transparent border-b border-border focus:border-primary outline-none text-fg text-sm py-0 flex-1 font-medium"
      @keydown="onKeydown"
      @blur="confirmEdit"
    />
    <span
      v-else
      class="text-fg-3 text-sm font-medium cursor-text select-none flex-1 truncate"
      @click="startEdit()"
    >
      {{ title }}
    </span>

    <button
      class="opacity-0 group-hover/header:opacity-100 text-fg-4 hover:text-danger transition-all text-xs shrink-0 cursor-pointer"
      @click="emit('remove')"
    >
      ✕
    </button>
  </div>
</template>
