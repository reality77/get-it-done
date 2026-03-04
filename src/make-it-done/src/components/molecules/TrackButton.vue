<script setup lang="ts">
import { ref } from 'vue'
import type { Checklist, TaskPriority, TaskEffort } from '../../types'
import { useChecklistStore } from '../../stores/checklists'
import AppButton from '../atoms/AppButton.vue'

const props = defineProps<{ checklist: Checklist }>()

const { enableTracking, disableTracking } = useChecklistStore()

// ── Dialog state ──────────────────────────────────────────────────────────────
const dialogOpen = ref(false)
const selectedPriority = ref<TaskPriority>('important')
const selectedEffort = ref<TaskEffort>('medium')

function openDialog(): void {
  selectedPriority.value = props.checklist.defaultPriority ?? 'important'
  selectedEffort.value = props.checklist.defaultEffort ?? 'medium'
  dialogOpen.value = true
}

function confirm(): void {
  enableTracking(props.checklist.id, selectedPriority.value, selectedEffort.value)
  dialogOpen.value = false
}

function cancel(): void {
  dialogOpen.value = false
}

function handleOverlayClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) cancel()
}

// ── Style maps ─────────────────────────────────────────────────────────────────
const priorityOptions: { value: TaskPriority; label: string; icon: string; active: string; inactive: string }[] = [
  {
    value: 'urgent',
    label: 'Urgent',
    icon: '🔴',
    active: 'bg-red-950 border-red-500 text-red-300',
    inactive: 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500',
  },
  {
    value: 'important',
    label: 'Important',
    icon: '🟡',
    active: 'bg-yellow-950 border-yellow-500 text-yellow-300',
    inactive: 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500',
  },
  {
    value: 'secondary',
    label: 'Secondary',
    icon: '⚪',
    active: 'bg-zinc-700 border-zinc-500 text-zinc-200',
    inactive: 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500',
  },
]

const effortOptions: { value: TaskEffort; label: string; icon: string; active: string; inactive: string }[] = [
  {
    value: 'small',
    label: 'Small',
    icon: 'S',
    active: 'bg-emerald-950 border-emerald-500 text-emerald-300',
    inactive: 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500',
  },
  {
    value: 'medium',
    label: 'Medium',
    icon: 'M',
    active: 'bg-blue-950 border-blue-500 text-blue-300',
    inactive: 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500',
  },
  {
    value: 'large',
    label: 'Large',
    icon: 'L',
    active: 'bg-orange-950 border-orange-500 text-orange-300',
    inactive: 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500',
  },
]
</script>

<template>
  <!-- Track toggle button -->
  <button
    v-if="checklist.kind !== 'template' && !checklist.archived"
    class="text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer"
    :class="checklist.tracked
      ? 'bg-violet-600/20 border-violet-500 text-violet-300'
      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'"
    :title="checklist.tracked ? 'Tracked as tasks — click to disable' : 'Track items as tasks'"
    @click="checklist.tracked ? disableTracking(checklist.id) : openDialog()"
  >
    <span class="sm:hidden">{{ checklist.tracked ? '◎' : '○' }}</span>
    <span class="hidden sm:inline">{{ checklist.tracked ? '◎ Tracked' : '○ Track' }}</span>
  </button>

  <!-- Dialog -->
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="dialogOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        @click="handleOverlayClick"
      >
        <div class="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <!-- Header -->
          <h2 class="text-zinc-100 font-semibold text-base mb-1">Track as tasks</h2>
          <p class="text-zinc-500 text-xs mb-5">
            Choose the default importance and effort for items in
            <span class="text-zinc-300">{{ checklist.title }}</span>.
          </p>

          <!-- Priority -->
          <p class="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Importance</p>
          <div class="flex gap-2 mb-5">
            <button
              v-for="opt in priorityOptions"
              :key="opt.value"
              class="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer"
              :class="selectedPriority === opt.value ? opt.active : opt.inactive"
              @click="selectedPriority = opt.value"
            >
              <span class="text-base">{{ opt.icon }}</span>
              <span>{{ opt.label }}</span>
            </button>
          </div>

          <!-- Effort -->
          <p class="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Effort</p>
          <div class="flex gap-2 mb-6">
            <button
              v-for="opt in effortOptions"
              :key="opt.value"
              class="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer"
              :class="selectedEffort === opt.value ? opt.active : opt.inactive"
              @click="selectedEffort = opt.value"
            >
              <span class="text-base font-bold">{{ opt.icon }}</span>
              <span>{{ opt.label }}</span>
            </button>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 justify-end">
            <AppButton variant="ghost" @click="cancel">Cancel</AppButton>
            <AppButton variant="primary" @click="confirm">Start Tracking</AppButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.15s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
.dialog-fade-enter-active > div,
.dialog-fade-leave-active > div {
  transition: transform 0.15s ease;
}
.dialog-fade-enter-from > div,
.dialog-fade-leave-to > div {
  transform: scale(0.95);
}
</style>
