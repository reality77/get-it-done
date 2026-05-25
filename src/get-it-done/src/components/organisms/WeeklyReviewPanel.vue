<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { TrackedItemRef, SwipeActionDef, ButtonActionDef } from '../../types'
import { makeStatusActions, refToId } from '../../composables/useTaskActions'
import { useChecklistStore } from '../../stores/checklists'
import TaskCard from '../molecules/TaskCard.vue'
import VButton from '../atoms/VButton.vue'

const emit = defineEmits<{
  (e: 'complete-review'): void
  (e: 'dismiss'): void
}>()

const store = useChecklistStore()

const candidates = ref<TrackedItemRef[]>([])
const dismissedIds = ref<Set<string>>(new Set())

onMounted(() => {
  candidates.value = store.suggestWeekPlan()
})

const visible = computed(() =>
  candidates.value.filter(r => !dismissedIds.value.has(r.item.id))
)

function dismissFromPanel(id: string): void {
  const next = new Set(dismissedIds.value)
  next.add(id)
  dismissedIds.value = next
}

function reviewSwipeRight(taskRef: TrackedItemRef): SwipeActionDef {
  return {
    hint: 'Next week',
    bgClass: 'bg-warning',
    onTrigger: () => {
      const d = new Date()
      d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7))
      store.snoozeItem(refToId(taskRef), d.toISOString().slice(0, 10))
      dismissFromPanel(taskRef.item.id)
    },
  }
}

function reviewSwipeLeft(taskRef: TrackedItemRef): SwipeActionDef {
  return {
    hint: 'Add to week',
    bgClass: 'bg-success',
    onTrigger: () => {
      const id = refToId(taskRef)
      store.activateItem(id)
      store.toggleItemWeekPlan(id)
      dismissFromPanel(taskRef.item.id)
    },
  }
}

function cardActions(taskRef: TrackedItemRef): ButtonActionDef[] {
  return makeStatusActions(taskRef, {
    onActivate: (id) => store.activateItem(id),
    onSnooze: (id, date) => store.snoozeItem(id, date),
    onDelete: (id) => { store.removeItem(id); dismissFromPanel(taskRef.item.id) },
  })
}
</script>

<template>
  <div class="bg-bg-1 border border-primary/25 rounded-xl p-4 mb-6">
    <div class="flex items-center justify-between mb-1">
      <h3 class="text-sm font-semibold text-fg">Weekly Review</h3>
      <VButton variant="ghost" class="text-xs" @click="$emit('dismiss')">Dismiss</VButton>
    </div>
    <p class="text-xs text-fg-4 mb-4">
      {{ visible.length > 0 ? `${visible.length} task${visible.length === 1 ? '' : 's'} to review` : 'All reviewed' }}
      · swipe left to add to week, right to defer
    </p>

    <div v-if="visible.length > 0" class="space-y-1 mb-4">
      <TaskCard
        v-for="ref in visible"
        :key="ref.item.id"
        :item="ref.item"
        :checklist-id="ref.checklistId"
        :checklist-title="ref.checklistTitle"
        :compact="true"
        :swipe-right="reviewSwipeRight(ref)"
        :swipe-left="reviewSwipeLeft(ref)"
        :actions="cardActions(ref)"
        :collapse-mobile-actions="true"
      />
    </div>

    <div v-else class="text-sm text-fg-4 mb-4">
      No tasks to review — your week is planned!
    </div>

    <VButton variant="primary" @click="$emit('complete-review')">
      Mark review complete
    </VButton>
  </div>
</template>
