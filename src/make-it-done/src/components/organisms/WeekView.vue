<script setup lang="ts">
import { ref } from 'vue'
import type { TrackedItemRef, TaskPriority, TaskEffort, ChecklistItemId } from '../../types'
import TaskCard from '../molecules/TaskCard.vue'

const props = defineProps<{
  itemsByPriority: {
    urgent: TrackedItemRef[]
    important: TrackedItemRef[]
    secondary: TrackedItemRef[]
  }
}>()

const emit = defineEmits<{
  (e: 'snooze', id: ChecklistItemId, date: string): void
  (e: 'someday', id: ChecklistItemId): void
  (e: 'delete', id: ChecklistItemId): void
  (e: 'update-priority', id: ChecklistItemId, priority: TaskPriority): void
  (e: 'update-effort', id: ChecklistItemId, effort: TaskEffort): void
  (e: 'update-text', id: ChecklistItemId, text: string): void
  (e: 'toggle-day', id: ChecklistItemId): void
  (e: 'toggle-done', id: ChecklistItemId): void
}>()

const collapsed = ref<Record<TaskPriority, boolean>>({
  urgent: false,
  important: false,
  secondary: false,
})

const sections: { priority: TaskPriority; label: string; dotColor: string }[] = [
  { priority: 'urgent',    label: 'Urgent',    dotColor: 'bg-red-500' },
  { priority: 'important', label: 'Important', dotColor: 'bg-yellow-500' },
  { priority: 'secondary', label: 'Secondary', dotColor: 'bg-zinc-500' },
]

/** Group items within a priority section by their checklist title */
function groupByChecklist(items: TrackedItemRef[]): Map<string, TrackedItemRef[]> {
  const map = new Map<string, TrackedItemRef[]>()
  for (const ref of items) {
    const key = ref.checklistTitle
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(ref)
  }
  return map
}
</script>

<template>
  <div class="space-y-6">
    <section
      v-for="section in sections"
      :key="section.priority"
    >
      <!-- Section header -->
      <div class="flex items-center gap-2 mb-2">
        <span class="w-2 h-2 rounded-full shrink-0" :class="section.dotColor" />
        <button
          class="flex-1 text-left text-sm font-semibold text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
          @click="collapsed[section.priority] = !collapsed[section.priority]"
        >
          {{ section.label }}
          <span class="text-zinc-600 font-normal ml-1">
            ({{ itemsByPriority[section.priority].length }})
          </span>
        </button>
      </div>

      <!-- Items grouped by checklist -->
      <div v-if="!collapsed[section.priority]" class="space-y-3 pl-4">
        <div
          v-if="itemsByPriority[section.priority].length === 0"
          class="text-xs text-zinc-600 py-2"
        >
          No {{ section.label.toLowerCase() }} items
        </div>

        <div
          v-for="[clTitle, refs] in groupByChecklist(itemsByPriority[section.priority])"
          :key="clTitle"
        >
          <!-- Checklist sub-header -->
          <p class="text-xs text-zinc-500 mb-1 font-medium">{{ clTitle }}</p>
          <div class="space-y-0.5">
            <div
              v-for="ref in refs"
              :key="ref.item.id"
              class="relative"
            >
              <!-- Day plan toggle checkbox -->
              <button
                class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 w-3.5 h-3.5 rounded border transition-colors cursor-pointer"
                :class="ref.item.selectedForToday
                  ? 'bg-violet-600 border-violet-600'
                  : 'border-zinc-700 hover:border-zinc-500'"
                :title="ref.item.selectedForToday ? 'Remove from today' : 'Add to today'"
                @click="$emit('toggle-day', { checklistId: ref.checklistId, itemId: ref.item.id })"
              >
                <span v-if="ref.item.selectedForToday" class="text-white text-[10px] leading-none flex items-center justify-center w-full h-full">✓</span>
              </button>

              <TaskCard
                :item="ref.item"
                :checklist-id="ref.checklistId"
                :checklist-title="ref.checklistTitle"
                @toggle-done="(id) => $emit('toggle-done', id)"
                @snooze="(id, date) => $emit('snooze', id, date)"
                @someday="(id) => $emit('someday', id)"
                @activate="() => {}"
                @delete="(id) => $emit('delete', id)"
                @update-text="(id, text) => $emit('update-text', id, text)"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
