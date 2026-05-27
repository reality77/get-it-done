<script setup lang="ts">
import { computed, ref } from 'vue'
import { getSnoozeOptions, getDeadlineSnoozeOptions, type SnoozeOption } from '../../composables/useSnoozeOptions'

const props = defineProps<{
  deadline?: string | null
}>()

const emit = defineEmits<{
  (e: 'pick', date: string): void
  (e: 'cancel'): void
}>()

type Segment = 'standard' | 'deadline'

const standardOptions: SnoozeOption[] = getSnoozeOptions()

const deadlineOptions = computed<SnoozeOption[]>(() =>
  props.deadline ? getDeadlineSnoozeOptions(props.deadline) : []
)

const hasDeadlineSegment = computed(() => deadlineOptions.value.length > 0)
const activeSegment = ref<Segment>('standard')

const visibleOptions = computed<SnoozeOption[]>(() =>
  activeSegment.value === 'deadline' && hasDeadlineSegment.value
    ? deadlineOptions.value
    : standardOptions
)

const customDate = ref('')
const todayStr = new Date().toISOString().slice(0, 10)

function formatDate(date: string): string {
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
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      @click.self="$emit('cancel')"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('cancel')" />

      <!-- Sheet -->
      <div class="relative bg-bg-1 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl p-4">
        <h2 class="text-sm font-semibold text-fg-2 mb-3">Snooze until…</h2>

        <!-- Segment control -->
        <div v-if="hasDeadlineSegment" class="flex bg-bg-2 rounded-lg p-1 mb-3 gap-1">
          <button
            class="flex-1 text-xs font-medium py-1.5 rounded-md transition-colors"
            :class="activeSegment === 'standard' ? 'bg-bg-1 text-fg shadow-sm' : 'text-fg-3 hover:text-fg'"
            @click="activeSegment = 'standard'"
          >Dates</button>
          <button
            class="flex-1 text-xs font-medium py-1.5 rounded-md transition-colors"
            :class="activeSegment === 'deadline' ? 'bg-bg-1 text-fg shadow-sm' : 'text-fg-3 hover:text-fg'"
            @click="activeSegment = 'deadline'"
          >Before deadline</button>
        </div>

        <!-- Options list -->
        <div class="space-y-0.5 mb-3">
          <button
            v-for="opt in visibleOptions"
            :key="opt.date"
            class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-fg-2 hover:bg-bg-2 hover:text-fg transition-colors"
            @click="$emit('pick', opt.date)"
          >
            <span>{{ opt.label }}</span>
            <span class="text-fg-4 text-xs">{{ formatDate(opt.date) }}</span>
          </button>
        </div>

        <!-- Custom date -->
        <div class="border-t border-border pt-3 flex gap-2">
          <input
            v-model="customDate"
            type="date"
            :min="todayStr"
            class="flex-1 bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-opacity"
            :disabled="!customDate"
            @click="submitCustom"
          >OK</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
