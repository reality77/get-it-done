<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Checklist, TaskPriority, TaskEffort, TrackMode } from '../../types'
import { useChecklistStore } from '../../stores/checklists'
import VButton from '../atoms/VButton.vue'

const props = defineProps<{ checklist: Checklist }>()

const { enableTracking, enableChecklistTracking, disableTracking } = useChecklistStore()

// ── Dialog state ──────────────────────────────────────────────────────────────
const dialogOpen = ref(false)
const selectedMode = ref<'items' | 'checklist'>('items')
const selectedPriority = ref<TaskPriority>('important')
const selectedEffort = ref<TaskEffort>('medium')

const isSwitching = computed(() =>
  props.checklist.trackMode !== 'none'
)

function openDialog(): void {
  selectedMode.value = props.checklist.trackMode === 'checklist' ? 'checklist' : 'items'
  selectedPriority.value = props.checklist.defaultPriority ?? 'important'
  selectedEffort.value = props.checklist.defaultEffort ?? 'medium'
  dialogOpen.value = true
}

function confirm(): void {
  if (selectedMode.value === 'items') {
    enableTracking(props.checklist.id, selectedPriority.value, selectedEffort.value)
  } else {
    enableChecklistTracking(props.checklist.id, selectedPriority.value, selectedEffort.value)
  }
  dialogOpen.value = false
}

function disable(): void {
  disableTracking(props.checklist.id)
  dialogOpen.value = false
}

function cancel(): void {
  dialogOpen.value = false
}

function handleOverlayClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) cancel()
}

// ── Button label ───────────────────────────────────────────────────────────────
const buttonLabel = computed(() => {
  if (props.checklist.trackMode === 'items') return { short: '◎', long: '◎ Items' }
  if (props.checklist.trackMode === 'checklist') return { short: '◎', long: '◎ Checklist' }
  return { short: '○', long: '○ Track' }
})

const isTracked = computed(() => props.checklist.trackMode !== 'none')

// ── Style maps ─────────────────────────────────────────────────────────────────
const priorityOptions: { value: TaskPriority; label: string; icon: string; active: string; inactive: string }[] = [
  {
    value: 'urgent',
    label: 'Urgent',
    icon: '🔴',
    active: 'bg-danger/20 border-danger text-danger',
    inactive: 'bg-bg-2 border-border text-fg-3 hover:border-border-strong',
  },
  {
    value: 'important',
    label: 'Important',
    icon: '🟡',
    active: 'bg-warning/20 border-warning text-warning',
    inactive: 'bg-bg-2 border-border text-fg-3 hover:border-border-strong',
  },
  {
    value: 'secondary',
    label: 'Secondary',
    icon: '⚪',
    active: 'bg-bg-3 border-border-strong text-fg',
    inactive: 'bg-bg-2 border-border text-fg-3 hover:border-border-strong',
  },
]

const effortOptions: { value: TaskEffort; label: string; icon: string; active: string; inactive: string }[] = [
  {
    value: 'small',
    label: 'Small',
    icon: 'S',
    active: 'bg-success/20 border-success text-success',
    inactive: 'bg-bg-2 border-border text-fg-3 hover:border-border-strong',
  },
  {
    value: 'medium',
    label: 'Medium',
    icon: 'M',
    active: 'bg-info/20 border-info text-info',
    inactive: 'bg-bg-2 border-border text-fg-3 hover:border-border-strong',
  },
  {
    value: 'large',
    label: 'Large',
    icon: 'L',
    active: 'bg-secondary/20 border-secondary text-secondary',
    inactive: 'bg-bg-2 border-border text-fg-3 hover:border-border-strong',
  },
]

const modeOptions: { value: 'items' | 'checklist'; label: string; description: string }[] = [
  {
    value: 'items',
    label: 'Track Items',
    description: 'Each item becomes a separate task',
  },
  {
    value: 'checklist',
    label: 'Track Checklist',
    description: 'The whole checklist is one task',
  },
]

function modeClass(mode: TrackMode): string {
  return selectedMode.value === mode
    ? 'border-primary bg-primary/10 text-primary'
    : 'border-border bg-bg-2 text-fg-3 hover:border-border-strong hover:text-fg-2'
}
</script>

<template>
  <!-- Track toggle button -->
  <button
    v-if="checklist.kind !== 'template' && !checklist.archived"
    class="text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer"
    :class="isTracked
      ? 'bg-primary/20 border-primary text-primary'
      : 'border-border text-fg-4 hover:border-border-strong hover:text-fg-2'"
    :title="checklist.trackMode === 'items' ? 'Tracked as items — click to change'
          : checklist.trackMode === 'checklist' ? 'Tracked as checklist — click to change'
          : 'Track as tasks'"
    @click="openDialog"
  >
    <span class="sm:hidden">{{ buttonLabel.short }}</span>
    <span class="hidden sm:inline">{{ buttonLabel.long }}</span>
  </button>

  <!-- Dialog -->
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="dialogOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        @click="handleOverlayClick"
      >
        <div class="bg-bg-1 border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <!-- Header -->
          <h2 class="text-fg font-semibold text-base mb-1">Track as tasks</h2>
          <p class="text-fg-4 text-xs mb-5">
            Choose how to track
            <span class="text-fg-2">{{ checklist.title }}</span>.
          </p>

          <!-- Mode selection -->
          <p class="text-fg-3 text-xs font-medium uppercase tracking-wide mb-2">Mode</p>
          <div class="flex gap-2 mb-5">
            <button
              v-for="opt in modeOptions"
              :key="opt.value"
              class="flex-1 flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer text-left"
              :class="modeClass(opt.value)"
              @click="selectedMode = opt.value"
            >
              <span class="font-semibold">{{ opt.label }}</span>
              <span class="font-normal opacity-70">{{ opt.description }}</span>
            </button>
          </div>

          <!-- Mode switch warning -->
          <p
            v-if="isSwitching && checklist.trackMode !== selectedMode"
            class="text-warning text-xs mb-4 bg-warning/10 border border-warning/30 rounded-lg px-3 py-2"
          >
            Switching modes will clear existing task fields.
          </p>

          <!-- Priority -->
          <p class="text-fg-3 text-xs font-medium uppercase tracking-wide mb-2">Default importance</p>
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
          <p class="text-fg-3 text-xs font-medium uppercase tracking-wide mb-2">Default effort</p>
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
          <div class="flex gap-2 justify-between">
            <VButton v-if="isSwitching" variant="ghost" class="text-danger" @click="disable">
              Disable tracking
            </VButton>
            <div class="flex gap-2 ml-auto">
              <VButton variant="ghost" @click="cancel">Cancel</VButton>
              <VButton variant="primary" @click="confirm">
                {{ isSwitching ? 'Apply' : 'Start Tracking' }}
              </VButton>
            </div>
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
