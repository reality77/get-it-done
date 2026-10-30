<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import type { Checklist, TaskPriority, TaskEffort, TrackMode } from '../../types'
import { useChecklistStore } from '../../stores/checklists'
import VSegmented from '../atoms/VSegmented.vue'
import VToggle from '../atoms/VToggle.vue'
import VField from '../atoms/VField.vue'

const props = defineProps<{
  checklist: Checklist
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'archive', checklistId: string): void
  (e: 'run', checklistId: string): void
  (e: 'delete', checklistId: string): void
}>()

const {
  enableTracking, enableChecklistTracking, disableTracking, setOrdered, updateChecklist,
} = useChecklistStore()

const isTemplate = computed(() => props.checklist.kind === 'template')
const canTrack = computed(() => !isTemplate.value && !props.checklist.archived)

// ── Title ─────────────────────────────────────────────────────────────────────
// Runs display their run label, so only plain checklists and templates are renamable.
const canRename = computed(() => !props.checklist.runLabel)
const titleDraft = ref('')

function saveTitle(): void {
  const title = titleDraft.value.trim()
  if (title && title !== props.checklist.title) updateChecklist(props.checklist.id, { title })
  else titleDraft.value = props.checklist.title
}

// ── Tracking ──────────────────────────────────────────────────────────────────
const priority = ref<TaskPriority>('important')
const effort = ref<TaskEffort>('medium')

// Leaving or switching an existing tracking mode clears task fields → confirm first.
const pendingMode = ref<TrackMode | null>(null)

function applyMode(mode: TrackMode): void {
  if (mode === 'none') disableTracking(props.checklist.id)
  else if (mode === 'items') enableTracking(props.checklist.id, priority.value, effort.value)
  else enableChecklistTracking(props.checklist.id, priority.value, effort.value)
  pendingMode.value = null
}

function selectMode(value: string | number): void {
  const mode = value as TrackMode
  if (mode === props.checklist.trackMode) { pendingMode.value = null; return }
  if (props.checklist.trackMode === 'none') applyMode(mode)
  else pendingMode.value = mode
}

function setDefaults(p: TaskPriority, e: TaskEffort): void {
  priority.value = p
  effort.value = e
  // Re-applying the current mode only updates the defaults; existing task values are kept.
  if (props.checklist.trackMode !== 'none') applyMode(props.checklist.trackMode)
}

const modeOptions = [
  { value: 'none', label: 'Off' },
  { value: 'items', label: 'Each item' },
  { value: 'checklist', label: 'Whole list' },
]

const modeHints: Record<TrackMode, string> = {
  none: 'Not shown in Today, Week or Backlog.',
  items: 'Every item becomes its own task.',
  checklist: 'The checklist is a single task.',
}

const priorityOptions: { value: TaskPriority; label: string; icon: string; active: string }[] = [
  { value: 'urgent', label: 'Urgent', icon: '🔴', active: 'bg-danger/20 border-danger text-danger' },
  { value: 'important', label: 'Important', icon: '🟡', active: 'bg-warning/20 border-warning text-warning' },
  { value: 'secondary', label: 'Secondary', icon: '⚪', active: 'bg-bg-3 border-border-strong text-fg' },
]

const effortOptions: { value: TaskEffort; label: string; active: string }[] = [
  { value: 'small', label: 'S', active: 'bg-success/20 border-success text-success' },
  { value: 'medium', label: 'M', active: 'bg-info/20 border-info text-info' },
  { value: 'large', label: 'L', active: 'bg-secondary/20 border-secondary text-secondary' },
]

const chipInactive = 'bg-bg-2 border-border text-fg-3 hover:border-border-strong'
const actionClass = 'flex items-center justify-center w-full h-11 text-sm font-medium rounded-xl border transition-colors'

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

// ── Open / close ──────────────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

watch(() => props.open, (open) => {
  if (open) {
    titleDraft.value = props.checklist.title
    priority.value = props.checklist.defaultPriority ?? 'important'
    effort.value = props.checklist.defaultEffort ?? 'medium'
    pendingMode.value = null
    confirmDelete.value = false
    window.addEventListener('keydown', onKeydown)
  } else {
    window.removeEventListener('keydown', onKeydown)
  }
}, { immediate: true })

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

        <div
          role="dialog"
          aria-label="Checklist settings"
          class="sheet-panel relative w-full sm:max-w-md bg-bg-1 border-t sm:border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        >
          <!-- Grab handle (mobile) -->
          <div class="sm:hidden flex justify-center pt-2">
            <span class="h-1 w-10 rounded-full bg-border-strong" />
          </div>

          <div class="p-4 space-y-5">
            <!-- Title -->
            <form v-if="canRename" @submit.prevent="saveTitle">
              <VField v-model="titleDraft" label="Name" @blur="saveTitle" />
            </form>
            <p v-else class="text-base font-semibold text-fg truncate">{{ checklist.runLabel }}</p>

            <!-- Tracking -->
            <section v-if="canTrack" class="space-y-3">
              <h3 class="text-xs font-medium uppercase tracking-wide text-fg-3">Track as tasks</h3>
              <VSegmented
                :model-value="pendingMode ?? checklist.trackMode"
                :options="modeOptions"
                @update:model-value="selectMode"
              />
              <p class="text-xs text-fg-4">{{ modeHints[pendingMode ?? checklist.trackMode] }}</p>

              <div
                v-if="pendingMode"
                class="text-xs bg-warning/10 border border-warning/30 text-warning rounded-lg px-3 py-2 space-y-2"
              >
                <p>
                  {{ pendingMode === 'none' ? 'Turning tracking off' : 'Switching mode' }}
                  clears priorities, plans and snoozes set on the current tasks.
                </p>
                <div class="flex gap-2 justify-end">
                  <button class="px-3 py-1.5 rounded-lg text-fg-2 hover:bg-bg-2" @click="pendingMode = null">Cancel</button>
                  <button class="px-3 py-1.5 rounded-lg bg-warning text-bg-0 font-semibold" @click="applyMode(pendingMode)">Confirm</button>
                </div>
              </div>

              <template v-if="checklist.trackMode !== 'none' && !pendingMode">
                <div class="flex gap-2">
                  <button
                    v-for="opt in priorityOptions"
                    :key="opt.value"
                    class="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border text-xs font-medium transition-colors"
                    :class="priority === opt.value ? opt.active : chipInactive"
                    @click="setDefaults(opt.value, effort)"
                  >
                    <span>{{ opt.icon }}</span>{{ opt.label }}
                  </button>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-fg-3 w-14 shrink-0">Effort</span>
                  <button
                    v-for="opt in effortOptions"
                    :key="opt.value"
                    class="flex-1 h-10 rounded-lg border text-xs font-bold transition-colors"
                    :class="effort === opt.value ? opt.active : chipInactive"
                    @click="setDefaults(priority, opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
                <p class="text-xs text-fg-4">Defaults for new tasks; existing tasks keep their values.</p>
              </template>
            </section>

            <!-- Ordered -->
            <section v-if="!checklist.archived" class="space-y-1.5">
              <VToggle v-model="ordered" label="Ordered steps" />
              <p class="text-xs text-fg-4">
                Items are numbered; only the next undone step can be planned as a task.
              </p>
            </section>

            <!-- Actions -->
            <section class="space-y-2 pt-1 border-t border-hairline">
              <button
                v-if="isTemplate"
                :class="[actionClass, 'border-border bg-bg-2 hover:bg-bg-3 text-primary']"
                @click="emit('run', checklist.id); emit('close')"
              >
                ▷ Start a run
              </button>
              <button
                v-if="!isTemplate && !checklist.archived"
                :class="[actionClass, 'border-border bg-bg-2 hover:bg-bg-3 text-fg-2']"
                @click="emit('archive', checklist.id); emit('close')"
              >
                🗄 Archive
              </button>
              <button
                :class="[actionClass, confirmDelete
                  ? 'bg-danger border-danger text-white'
                  : 'border-border bg-bg-2 hover:bg-bg-3 text-danger']"
                @click="onDelete"
              >
                <template v-if="!confirmDelete">🗑 Delete</template>
                <template v-else-if="isTemplate">Tap again — deletes the template and all its runs</template>
                <template v-else>Tap again to delete for good</template>
              </button>
            </section>

            <button
              class="w-full h-11 rounded-xl bg-bg-2 text-sm font-medium text-fg hover:bg-bg-3 transition-colors"
              @click="emit('close')"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.2s ease;
}
.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .sheet-enter-from .sheet-panel,
  .sheet-leave-to .sheet-panel {
    transform: scale(0.95);
  }
}
</style>
