<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TrackedItemRef, ChecklistItemId, ButtonActionDef } from '../../types'
import DayPlanBar from '../molecules/DayPlanBar.vue'
import TaskCard from '../molecules/TaskCard.vue'

const props = defineProps<{
  items: TrackedItemRef[]
  allActiveItems: TrackedItemRef[]
}>()

const emit = defineEmits<{
  (e: 'suggest'): void
  (e: 'clear'): void
  (e: 'toggle-done', id: ChecklistItemId): void
  (e: 'snooze', id: ChecklistItemId, date: string): void
  (e: 'someday', id: ChecklistItemId): void
  (e: 'delete', id: ChecklistItemId): void
  (e: 'update-text', id: ChecklistItemId, text: string): void
}>()

function dayActions(ref: TrackedItemRef): ButtonActionDef[] {
  const id: ChecklistItemId = { checklistId: ref.checklistId, itemId: ref.item.id }
  return [
    { label: '💤', title: 'Snooze', variant: 'icon', snooze: (date) => emit('snooze', id, date) },
    { label: '☁', title: 'Someday', variant: 'icon', onClick: () => emit('someday', id) },
    { label: '✕', title: 'Delete', variant: 'danger', onClick: () => emit('delete', id) },
  ]
}

const activeItems = computed(() => props.items.filter(r => !r.item.done))
const completedItems = computed(() => props.items.filter(r => r.item.done))

// Celebration — fires when the last active item is ticked off
const showCelebration = ref(false)
let dismissTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => activeItems.value.length,
  (newLen, oldLen) => {
    // Only celebrate when we just hit zero (not on initial load)
    if (newLen === 0 && oldLen > 0 && completedItems.value.length > 0) {
      showCelebration.value = true
      if (dismissTimer) clearTimeout(dismissTimer)
      dismissTimer = setTimeout(() => { showCelebration.value = false }, 3500)
    }
  },
)

function dismissCelebration(): void {
  showCelebration.value = false
  if (dismissTimer) clearTimeout(dismissTimer)
}
</script>

<template>
  <div>
    <DayPlanBar
      :selected-count="items.length"
      :completed-count="completedItems.length"
      @suggest="$emit('suggest')"
      @clear="$emit('clear')"
    />

    <div v-if="items.length === 0 && completedItems.length === 0" class="text-center py-12">
      <p class="text-zinc-500 text-sm mb-2">No tasks planned for today</p>
      <p class="text-zinc-600 text-xs">
        Click <strong class="text-zinc-500">Suggest</strong> to auto-pick tasks,
        or go to the <strong class="text-zinc-500">Week</strong> view to select manually.
      </p>
    </div>

    <div v-if="activeItems.length > 0" class="space-y-1">
      <TaskCard
        v-for="taskRef in activeItems"
        :key="taskRef.item.id"
        :item="taskRef.item"
        :checklist-id="taskRef.checklistId"
        :checklist-title="taskRef.checklistTitle"
        :compact="true"
        :actions="dayActions(taskRef)"
        @toggle-done="(id) => $emit('toggle-done', id)"
        @update-text="(id, text) => $emit('update-text', id, text)"
      />
    </div>

    <!-- Completed items — shown at the bottom -->
    <div v-if="completedItems.length > 0" class="mt-6">
      <p class="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-1 px-2">
        Completed
      </p>
      <div class="space-y-1 opacity-60">
        <TaskCard
          v-for="taskRef in completedItems"
          :key="taskRef.item.id"
          :item="taskRef.item"
          :checklist-id="taskRef.checklistId"
          :checklist-title="taskRef.checklistTitle"
          :compact="true"
          :actions="dayActions(taskRef)"
          @toggle-done="(id) => $emit('toggle-done', id)"
          @update-text="(id, text) => $emit('update-text', id, text)"
        />
      </div>
    </div>

    <!-- Full-screen celebration overlay -->
    <Transition name="celebrate">
      <div
        v-if="showCelebration"
        class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm cursor-pointer"
        @click="dismissCelebration"
      >
        <!-- Confetti particles -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <span class="confetti" style="--x:10%;--delay:0s;--dur:1.2s">🎉</span>
          <span class="confetti" style="--x:22%;--delay:0.15s;--dur:1.4s">⭐</span>
          <span class="confetti" style="--x:35%;--delay:0.05s;--dur:1.1s">🎊</span>
          <span class="confetti" style="--x:50%;--delay:0.3s;--dur:1.5s">✨</span>
          <span class="confetti" style="--x:63%;--delay:0.1s;--dur:1.3s">🎉</span>
          <span class="confetti" style="--x:75%;--delay:0.25s;--dur:1.2s">⭐</span>
          <span class="confetti" style="--x:88%;--delay:0.2s;--dur:1.6s">🎊</span>
          <span class="confetti" style="--x:5%;--delay:0.4s;--dur:1.4s">✨</span>
          <span class="confetti" style="--x:45%;--delay:0.35s;--dur:1.1s">🌟</span>
          <span class="confetti" style="--x:80%;--delay:0.08s;--dur:1.3s">🌟</span>
        </div>

        <!-- Message -->
        <div class="relative text-center px-8 select-none">
          <p class="text-6xl mb-4 celebrate-bounce">🏆</p>
          <h2 class="text-2xl font-bold text-zinc-100 mb-2">All done!</h2>
          <p class="text-zinc-400 text-sm">You crushed today's plan.</p>
          <p class="text-zinc-600 text-xs mt-6">Tap to dismiss</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.confetti {
  position: absolute;
  left: var(--x);
  top: -2rem;
  font-size: 1.75rem;
  animation: fall var(--dur) ease-in var(--delay) infinite;
  animation-iteration-count: 3;
}

@keyframes fall {
  0%   { transform: translateY(0)   rotate(0deg);   opacity: 1; }
  80%  { opacity: 1; }
  100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
}

.celebrate-bounce {
  animation: bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes bounce-in {
  from { transform: scale(0.4); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

.celebrate-enter-active { transition: opacity 0.3s ease; }
.celebrate-leave-active { transition: opacity 0.4s ease; }
.celebrate-enter-from,
.celebrate-leave-to    { opacity: 0; }
</style>
