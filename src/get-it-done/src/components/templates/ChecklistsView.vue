<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import type { Checklist } from '../../types'
import { useChecklistStore } from '../../stores/checklists'
import { normalizeSearch, nodesMatchSearch } from '../../composables/useTreeHelpers'
import ChecklistFilterBar from '../molecules/ChecklistFilterBar.vue'
import ActiveView from './ActiveView.vue'

const store = useChecklistStore()
const { activeChecklists, archivedChecklists } = storeToRefs(store)

// Archived one-time checklists only (runs stay hidden), shown on demand.
const showArchived = ref(false)
const archivedOneTime = computed(() => archivedChecklists.value.filter(c => c.kind === 'one-time'))

// ── Filter ────────────────────────────────────────────────────────────────────
const query = ref('')
const normalizedQuery = computed(() => normalizeSearch(query.value))

// Checklists whose items match are expanded so the hit is visible.
const itemMatchIds = computed(() => {
  const ids = new Set<string>()
  if (!normalizedQuery.value) return ids
  for (const list of [activeChecklists.value, archivedOneTime.value]) {
    for (const c of list) {
      if (nodesMatchSearch(c.items, normalizedQuery.value)) ids.add(c.id)
    }
  }
  return ids
})

function applyFilter(checklists: Checklist[]): Checklist[] {
  const q = normalizedQuery.value
  if (!q) return checklists
  return checklists.filter(c =>
    normalizeSearch(c.runLabel ? `${c.title} ${c.runLabel}` : c.title).includes(q)
    || itemMatchIds.value.has(c.id)
  )
}

const filteredActive = computed(() => applyFilter(activeChecklists.value))
const filteredArchived = computed(() => showArchived.value ? applyFilter(archivedOneTime.value) : [])

// ── Create ────────────────────────────────────────────────────────────────────
const newlyCreatedId = ref<string | null>(null)

async function flashFocus(id: string): Promise<void> {
  newlyCreatedId.value = id
  await nextTick()
  newlyCreatedId.value = null
}

async function handleCreate(name: string): Promise<void> {
  const created = store.createChecklist('one-time', name, [])
  query.value = ''
  await flashFocus(created.id)
}
</script>

<template>
  <div>
    <ChecklistFilterBar
      v-model="query"
      v-model:show-archived="showArchived"
      :has-matches="filteredActive.length + filteredArchived.length > 0"
      placeholder="Filter or create a checklist…"
      @create="handleCreate"
    />

    <ActiveView
      :checklists="filteredActive"
      :archived="filteredArchived"
      :filtering="!!normalizedQuery"
      :expanded-ids="itemMatchIds"
      :focus-checklist-id="newlyCreatedId"
      @delete="store.deleteChecklist"
      @archive="store.archiveChecklist"
      @unarchive="store.unarchiveChecklist"
    />
  </div>
</template>
