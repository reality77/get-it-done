<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Checklist, ChecklistKind } from '../../types'
import AppButton from '../atoms/AppButton.vue'
import AppInput from '../atoms/AppInput.vue'

const props = defineProps<{
  checklist: Checklist | null
  defaultKind: 'one-time' | 'template'
}>()

const emit = defineEmits<{
  (e: 'save', payload: {
    id: string | null
    kind: ChecklistKind
    title: string
    items: { text: string; done: boolean }[]
  }): void
  (e: 'cancel'): void
}>()

const localTitle = ref(props.checklist?.title ?? '')
const localKind = ref<ChecklistKind>(props.checklist?.kind ?? props.defaultKind)
const localItems = ref<{ text: string; done: boolean }[]>(
  props.checklist?.items.map(i => ({ text: i.text, done: i.done })) ?? [],
)

function addItem(): void {
  localItems.value.push({ text: '', done: false })
}

function removeItem(index: number): void {
  localItems.value.splice(index, 1)
}

function onItemKeydown(e: KeyboardEvent, index: number): void {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (index === localItems.value.length - 1) addItem()
  }
}

function submit(): void {
  if (!localTitle.value.trim()) return
  emit('save', {
    id: props.checklist?.id ?? null,
    kind: localKind.value,
    title: localTitle.value.trim(),
    items: localItems.value.filter(i => i.text.trim()),
  })
}

function onEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('cancel')
}

onMounted(() => window.addEventListener('keydown', onEsc))
onUnmounted(() => window.removeEventListener('keydown', onEsc))
</script>

<template>
  <div
    class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
    @click.self="$emit('cancel')"
  >
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
      <h2 class="text-base font-semibold text-zinc-100 mb-5">
        {{ checklist ? 'Edit checklist' : 'New checklist' }}
      </h2>

      <!-- Kind selector (only when creating) -->
      <div v-if="!checklist" class="flex gap-4 mb-5">
        <label class="flex items-center gap-2 cursor-pointer text-sm text-zinc-400">
          <input type="radio" v-model="localKind" value="one-time" class="accent-violet-500" />
          One-time
        </label>
        <label class="flex items-center gap-2 cursor-pointer text-sm text-zinc-400">
          <input type="radio" v-model="localKind" value="template" class="accent-violet-500" />
          Template
        </label>
      </div>

      <!-- Title -->
      <div class="mb-5">
        <AppInput
          v-model="localTitle"
          placeholder="Checklist title"
          :autofocus="true"
          class="text-base"
          @keydown="(e: KeyboardEvent) => e.key === 'Enter' && submit()"
        />
      </div>

      <!-- Items -->
      <div class="space-y-2 mb-3">
        <div
          v-for="(item, i) in localItems"
          :key="i"
          class="flex items-center gap-2"
        >
          <AppInput
            v-model="item.text"
            placeholder="Item"
            @keydown="(e: KeyboardEvent) => onItemKeydown(e, i)"
          />
          <AppButton variant="icon" @click="removeItem(i)">✕</AppButton>
        </div>
      </div>

      <AppButton variant="ghost" class="mb-5" @click="addItem">+ Add item</AppButton>

      <!-- Actions -->
      <div class="flex justify-end gap-3">
        <AppButton variant="ghost" @click="$emit('cancel')">Cancel</AppButton>
        <AppButton
          variant="primary"
          type="submit"
          :disabled="!localTitle.trim()"
          @click="submit"
        >
          {{ checklist ? 'Save' : 'Create' }}
        </AppButton>
      </div>
    </div>
  </div>
</template>
