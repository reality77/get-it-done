<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Checklist, TrackMode } from '../../types'
import { useChecklistStore } from '../../stores/checklists'
import VSegmented from '../atoms/VSegmented.vue'
import VToggle from '../atoms/VToggle.vue'

const props = defineProps<{
  checklist: Checklist
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'archive', checklistId: string): void
  (e: 'delete', checklistId: string): void
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

function applyMode(mode: TrackMode): void {
  const { id, defaultPriority, defaultEffort } = props.checklist
  if (mode === 'none') disableTracking(id)
  else if (mode === 'items') enableTracking(id, defaultPriority, defaultEffort)
  else enableChecklistTracking(id, defaultPriority, defaultEffort)
  pendingMode.value = null
}

function selectMode(value: string | number): void {
  const mode = value as TrackMode
  if (mode === props.checklist.trackMode) pendingMode.value = null
  else if (props.checklist.trackMode === 'none') applyMode(mode)
  else pendingMode.value = mode
}

// ── Ordered ───────────────────────────────────────────────────────────────────
const ordered = computed({
  get: () => !!props.checklist.ordered,
  set: (v: boolean) => setOrdered(props.checklist.id, v),
})

// ── Delete (two taps) ─────────────────────────────────────────────────────────
const confirmDelete = ref(false)

function onDelete(): void {
  if (!confirmDelete.value) { confirmDelete.value = true; return }
  emit('delete', props.checklist.id)
  emit('close')
}

watch(() => props.open, () => {
  pendingMode.value = null
  confirmDelete.value = false
})
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
        </div>

        <!-- Ordered -->
        <VToggle v-model="ordered" label="Ordered steps" />

        <!-- Actions -->
        <div class="flex gap-2 pt-1">
          <button
            v-if="!isTemplate"
            class="flex-1 h-11 rounded-xl bg-bg-2 text-sm font-medium text-fg-2 hover:bg-bg-3 transition-colors"
            @click="emit('archive', checklist.id); emit('close')"
          >
            Archive
          </button>
          <button
            class="flex-1 h-11 rounded-xl text-sm font-medium transition-colors"
            :class="confirmDelete ? 'bg-danger text-white' : 'bg-bg-2 text-danger hover:bg-bg-3'"
            @click="onDelete"
          >
            {{ confirmDelete ? (isTemplate ? 'Delete + runs?' : 'Sure?') : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
