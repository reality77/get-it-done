<script setup lang="ts">
import { computed } from 'vue'
import type { Checklist } from '../../types'
import { countItems, countDone } from '../../composables/useTreeHelpers'
import VButton from '../atoms/VButton.vue'

const props = defineProps<{ checklist: Checklist }>()
const emit = defineEmits<{
  close: []
  archive: []
}>()

const allDone = computed(() =>
  countItems(props.checklist.items) > 0 &&
  countDone(props.checklist.items) === countItems(props.checklist.items)
)

function handleOk(): void {
  if (allDone.value) emit('archive')
  else emit('close')
}

function handleOverlayClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      @click="handleOverlayClick"
    >
      <div class="bg-bg-1 border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[80vh] flex flex-col">
        <!-- Header -->
        <h2 class="text-fg font-semibold text-base mb-1 shrink-0">Complete checklist</h2>
        <p class="text-fg-4 text-xs mb-4 shrink-0">
          Check off all items to archive
          <span class="text-fg-2">{{ checklist.title }}</span>.
        </p>

        <!-- Items tree -->
        <div class="overflow-y-auto flex-1 space-y-1 mb-5 pr-1">
          <ChecklistNodes :nodes="checklist.items" :checklist-id="checklist.id" />
        </div>

        <!-- Actions -->
        <div class="flex gap-2 justify-end shrink-0">
          <VButton variant="ghost" @click="emit('close')">Cancel</VButton>
          <VButton
            :variant="allDone ? 'primary' : 'ghost'"
            :class="!allDone ? 'opacity-50' : ''"
            @click="handleOk"
          >
            {{ allDone ? 'Archive' : 'Close' }}
          </VButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<!-- Recursive sub-component for the item tree -->
<script lang="ts">
import { defineComponent, h } from 'vue'
import type { PropType } from 'vue'
import type { ChecklistNode as TChecklistNode } from '../../types'
import { useChecklistStore as _useStore } from '../../stores/checklists'

const ChecklistNodes = defineComponent({
  name: 'ChecklistNodes',
  props: {
    nodes: { type: Array as PropType<TChecklistNode[]>, required: true },
    checklistId: { type: String, required: true },
  },
  setup(props) {
    const store = _useStore()

    function renderNodes(nodes: TChecklistNode[]): ReturnType<typeof h>[] {
      return nodes.map(node => {
        if (node.type === 'item') {
          return h('label', {
            key: node.id,
            class: 'flex items-center gap-2 py-1 cursor-pointer group',
          }, [
            h('input', {
              type: 'checkbox',
              checked: node.done,
              class: 'w-4 h-4 rounded accent-primary shrink-0',
              onChange: () => store.toggleItem({ checklistId: props.checklistId, itemId: node.id }),
            }),
            h('span', {
              class: ['text-sm', node.done ? 'line-through text-fg-4' : 'text-fg'],
            }, node.text),
          ])
        } else {
          return h('div', { key: node.id, class: 'mt-2' }, [
            h('p', { class: 'text-fg-3 text-xs font-medium uppercase tracking-wide mb-1' }, node.title),
            h('div', { class: 'pl-3 border-l border-border space-y-0.5' }, renderNodes(node.children)),
          ])
        }
      })
    }

    return () => h('div', renderNodes(props.nodes))
  },
})
</script>
