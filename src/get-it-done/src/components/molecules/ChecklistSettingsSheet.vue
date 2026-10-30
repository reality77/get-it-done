<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Checklist, TaskPriority, TaskEffort, TrackMode } from '../../types'
import { useChecklistStore } from '../../stores/checklists'
import VSegmented from '../atoms/VSegmented.vue'
import VToggle from '../atoms/VToggle.vue'

const props = defineProps<{
  checklist: Checklist
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { enableTracking, enableChecklistTracking, disableTracking, setOrdered } = useChecklistStore()

const isTemplate = computed(() => props.checklist.kind === 'template')

// ── Tracking ──────────────────────────────────────────────────────────────────
const modeOptions = [
  { value: 'none', label: 'Off' },
  { value: 'items', label: 'Items' },
  { value: 'checklist', label: 'List' },
]

// Leaving or switching an existing mode clears task fields → confirm first.
const pendingMode = ref<TrackMode | null>(null)

function applyMode(
  mode: TrackMode,
  priority: TaskPriority = props.checklist.defaultPriority,
  effort: TaskEffort = props.checklist.defaultEffort,
): void {
  const { id } = props.checklist
  if (mode === 'none') disableTracking(id)
  else if (mode === 'items') enableTracking(id, priority, effort)
  else enableChecklistTracking(id, priority, effort)
  pendingMode.value = null
}

function selectMode(value: string | number): void {
  const mode = value as TrackMode
  if (mode === props.checklist.trackMode) pendingMode.value = null
  else if (props.checklist.trackMode === 'none') applyMode(mode)
  else pendingMode.value = mode
}

// Re-applying the current mode only updates the defaults; existing tasks keep their values.
const priorityOptions: { value: TaskPriority; icon: string; active: string }[] = [
  { value: 'urgent', icon: '🔴', active: 'bg-danger/20 border-danger' },
  { value: 'important', icon: '🟡', active: 'bg-warning/20 border-warning' },
  { value: 'secondary', icon: '⚪', active: 'bg-bg-3 border-border-strong' },
]

const effortOptions: { value: TaskEffort; active: string }[] = [
  { value: 'small', active: 'bg-success/20 border-success text-success' },
  { value: 'medium', active: 'bg-info/20 border-info text-info' },
  { value: 'large', active: 'bg-secondary/20 border-secondary text-secondary' },
]

const chipClass = 'flex-1 h-9 rounded-lg border text-sm font-bold transition-colors'
const chipInactive = 'bg-bg-2 border-border text-fg-3'

// ── Ordered ───────────────────────────────────────────────────────────────────
const ordered = computed({
  get: () => !!props.checklist.ordered,
  set: (v: boolean) => setOrdered(props.checklist.id, v),
})

watch(() => props.open, () => { pendingMode.value = null })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
    >
      <div class="absolute inset-0 bg-black/60" @click="emit('close')" />

      <div class="relative w-full sm:max-w-sm bg-bg-1 border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4">
        <!-- Tracking -->
        <div v-if="!isTemplate" class="space-y-2">
          <p class="text-sm font-medium text-fg-2">Track as tasks</p>
          <VSegmented
            :model-value="pendingMode ?? checklist.trackMode"
            :options="modeOptions"
            @update:model-value="selectMode"
          />
          <div v-if="pendingMode" class="flex items-center gap-2 text-xs text-warning">
            <span class="flex-1">Clears current task settings.</span>
            <button class="px-2 py-1 text-fg-3" @click="pendingMode = null">Cancel</button>
            <button class="px-2 py-1 rounded-md bg-warning text-bg-0 font-semibold" @click="applyMode(pendingMode)">OK</button>
          </div>

          <!-- Default importance · effort -->
          <div v-else-if="checklist.trackMode !== 'none'" class="flex gap-3">
            <div class="flex-1 space-y-1">
              <p class="text-[11px] text-fg-4">Priority</p>
              <div class="flex gap-1.5">
                <button
                  v-for="opt in priorityOptions"
                  :key="opt.value"
                  :class="[chipClass, checklist.defaultPriority === opt.value ? opt.active : chipInactive]"
                  :title="opt.value"
                  @click="applyMode(checklist.trackMode, opt.value)"
                >
                  {{ opt.icon }}
                </button>
              </div>
            </div>
            <div class="flex-1 space-y-1">
              <p class="text-[11px] text-fg-4">Effort</p>
              <div class="flex gap-1.5">
                <button
                  v-for="opt in effortOptions"
                  :key="opt.value"
                  :class="[chipClass, checklist.defaultEffort === opt.value ? opt.active : chipInactive]"
                  :title="opt.value"
                  @click="applyMode(checklist.trackMode, undefined, opt.value)"
                >
                  {{ opt.value[0]!.toUpperCase() }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Ordered -->
        <VToggle v-model="ordered" label="Ordered steps" />
      </div>
    </div>
  </Teleport>
</template>
