<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TaskStatus } from '../../types'
import { getSnoozeOptions, getDeadlineSnoozeOptions, type SnoozeOption } from '../../composables/useSnoozeOptions'
import VSegmented from '../atoms/VSegmented.vue'

const props = defineProps<{
  taskName: string
  checklistTitle: string
  deadline?: string | null
  snoozeUntil?: string | null
  status?: TaskStatus
}>()

const emit = defineEmits<{
  (e: 'pick', date: string): void
  (e: 'someday'): void
  (e: 'cancel'): void
}>()

type Segment = 'standard' | 'deadline'

const standardOptions: SnoozeOption[] = getSnoozeOptions()

const deadlineOptions = computed<SnoozeOption[]>(() =>
  props.deadline ? getDeadlineSnoozeOptions(props.deadline) : []
)

const hasDeadlineSegment = computed(() => deadlineOptions.value.length > 0)

// Open on the segment that contains the current snooze date (if any)
const initialSegment = computed<Segment>(() => {
  if (props.snoozeUntil && deadlineOptions.value.some(o => o.date === props.snoozeUntil)) return 'deadline'
  return 'standard'
})
const activeSegment = ref<Segment>(initialSegment.value)

const visibleOptions = computed<SnoozeOption[]>(() =>
  activeSegment.value === 'deadline' && hasDeadlineSegment.value
    ? deadlineOptions.value
    : standardOptions
)

// Which date is currently active on the task
const activeDate = computed(() => props.status === 'snoozed' ? (props.snoozeUntil ?? null) : null)
const activeSomeday = computed(() => props.status === 'someday')

// If current snooze date doesn't match any preset, pre-fill the custom input
const allPresetDates = computed(() =>
  [...standardOptions, ...deadlineOptions.value].map(o => o.date)
)
const customDate = ref(
  props.snoozeUntil && !allPresetDates.value.includes(props.snoozeUntil)
    ? props.snoozeUntil
    : ''
)

const todayStr = new Date().toISOString().slice(0, 10)

function formatDeadline(deadline: string): string {
  return new Date(deadline.slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function formatOptionDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function submitCustom(): void {
  if (customDate.value) emit('pick', customDate.value)
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('cancel')" />

      <!-- Sheet -->
      <div class="relative bg-bg-1 border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl p-4 space-y-3">

        <!-- Task context header -->
        <div class="border-b border-hairline pb-3">
          <p class="text-sm font-semibold text-fg leading-snug">{{ taskName }}</p>
          <p class="text-xs text-fg-4 mt-0.5">{{ checklistTitle }}</p>
          <p v-if="deadline" class="text-xs text-warning mt-1">
            📅 Due {{ formatDeadline(deadline) }}
          </p>
        </div>

        <!-- Segment control (only when deadline options exist) -->
        <VSegmented
          v-if="hasDeadlineSegment"
          v-model="activeSegment"
          :options="[{ value: 'standard', label: 'Dates' }, { value: 'deadline', label: 'Before deadline' }]"
        />

        <!-- Date option grid -->
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="opt in visibleOptions"
            :key="opt.date"
            class="flex flex-col items-start px-3 py-2.5 rounded-xl border transition-[colors,transform] duration-100 text-left active:scale-[0.96]"
            :class="activeDate === opt.date
              ? 'bg-warning/20 border-warning text-warning'
              : 'bg-bg-2 border-border text-fg-2 hover:bg-bg-3'"
            @click="$emit('pick', opt.date)"
          >
            <span class="text-sm font-medium">{{ opt.label }}</span>
            <span class="text-xs mt-0.5" :class="activeDate === opt.date ? 'text-warning/70' : 'text-fg-4'">
              {{ formatOptionDate(opt.date) }}
            </span>
          </button>
        </div>

        <!-- Someday -->
        <button
          class="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-[colors,transform] duration-100 text-sm font-medium active:scale-[0.98]"
          :class="activeSomeday
            ? 'bg-info/20 border-info text-info'
            : 'bg-bg-2 border-border text-fg-2 hover:bg-bg-3'"
          @click="$emit('someday')"
        >
          <span>☁</span> Someday
        </button>

        <!-- Custom date -->
        <div class="border-t border-hairline pt-3 flex gap-2">
          <input
            v-model="customDate"
            type="date"
            :min="todayStr"
            class="flex-1 bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-fg-2 focus:border-primary focus:outline-none transition-colors"
          />
          <button
            class="px-4 py-2.5 bg-primary text-fg-on-primary text-sm font-semibold rounded-xl disabled:opacity-40 transition-[opacity,transform] duration-100 active:scale-[0.96]"
            :disabled="!customDate"
            @click="submitCustom"
          >OK</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
