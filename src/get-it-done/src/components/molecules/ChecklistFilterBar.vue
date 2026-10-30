<script setup lang="ts">
import VField from '../atoms/VField.vue'
import VButton from '../atoms/VButton.vue'

const props = defineProps<{
  placeholder?: string
  /** True when the current query matches existing checklists */
  hasMatches?: boolean
}>()

const emit = defineEmits<{
  (e: 'create', name: string): void
}>()

const query = defineModel<string>({ default: '' })
const showArchived = defineModel<boolean>('showArchived', { default: false })

function confirm(): void {
  const name = query.value.trim()
  if (name) emit('create', name)
}

// Enter (or the mobile Search/Go key) only creates when nothing matches,
// so searching for an existing list never creates a duplicate.
function onSubmit(): void {
  if (!props.hasMatches) confirm()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') query.value = ''
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="flex items-center gap-2 w-full mb-4">
    <VField
      v-model="query"
      type="search"
      :placeholder="placeholder ?? 'Filter checklists…'"
      class="flex-1 min-w-0"
      @keydown="onKeydown"
    />
    <button
      type="button"
      class="shrink-0 w-[42px] h-[42px] flex items-center justify-center rounded-2 border transition-colors"
      :class="showArchived
        ? 'bg-primary/20 border-primary text-primary'
        : 'bg-bg-1 border-border text-fg-3 hover:border-border-strong'"
      :aria-pressed="showArchived"
      :title="showArchived ? 'Hide archived checklists' : 'Show archived checklists'"
      @click="showArchived = !showArchived"
    >
      🗄
    </button>
    <VButton
      variant="primary"
      class="shrink-0"
      :disabled="!query.trim()"
      @click="confirm"
    >
      Create
    </VButton>
  </form>
</template>
