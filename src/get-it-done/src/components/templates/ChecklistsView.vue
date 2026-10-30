<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import type { Checklist } from '../../types'
import { useChecklistStore } from '../../stores/checklists'
import { normalizeSearch, nodesMatchSearch } from '../../composables/useTreeHelpers'
import VSegmented from '../atoms/VSegmented.vue'
import ChecklistFilterBar from '../molecules/ChecklistFilterBar.vue'
import ActiveView from './ActiveView.vue'
import TemplatesView from './TemplatesView.vue'
import ArchiveView from './ArchiveView.vue'

const store = useChecklistStore()
const { activeChecklists, templates, archivedChecklists } = storeToRefs(store)

const section = ref<'active' | 'templates' | 'archive'>('active')

// ── Filter ────────────────────────────────────────────────────────────────────
const query = ref('')
const normalizedQuery = computed(() => normalizeSearch(query.value))

// Checklists whose items match are expanded so the hit is visible.
const itemMatchIds = computed(() => {
  const ids = new Set<string>()
  if (!normalizedQuery.value) return ids
  for (const list of [activeChecklists.value, templates.value, archivedChecklists.value]) {
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
const filteredTemplates = computed(() => applyFilter(templates.value))
const filteredArchived = computed(() => applyFilter(archivedChecklists.value))

// ── Create ────────────────────────────────────────────────────────────────────
const newlyCreatedId = ref<string | null>(null)

async function flashFocus(id: string): Promise<void> {
  newlyCreatedId.value = id
  await nextTick()
  newlyCreatedId.value = null
}

async function handleCreate(name: string): Promise<void> {
  const kind = section.value === 'templates' ? 'template' : 'one-time'
  const created = store.createChecklist(kind, name, [])
  query.value = ''
  await flashFocus(created.id)
}
</script>

<template>
  <div>
    <VSegmented
      v-model="section"
      :options="[
        { value: 'active', label: 'Active' },
        { value: 'templates', label: 'Templates' },
        { value: 'archive', label: 'Archive' },
      ]"
      class="mb-4"
    />

    <ChecklistFilterBar
      v-model="query"
      :can-create="section !== 'archive'"
      :placeholder="section === 'archive' ? 'Filter archive…' : section === 'templates' ? 'Filter or create a template…' : 'Filter or create a checklist…'"
      @create="handleCreate"
    />

    <ActiveView
      v-if="section === 'active'"
      :checklists="filteredActive"
      :filtering="!!normalizedQuery"
      :expanded-ids="itemMatchIds"
      :focus-checklist-id="newlyCreatedId"
      @delete="store.deleteChecklist"
      @archive="store.archiveChecklist"
    />

    <TemplatesView
      v-else-if="section === 'templates'"
      :templates="filteredTemplates"
      :filtering="!!normalizedQuery"
      :expanded-ids="itemMatchIds"
      :focus-checklist-id="newlyCreatedId"
      @delete="store.deleteChecklist"
      @run="store.runTemplate"
    />

    <ArchiveView
      v-else
      :checklists="filteredArchived"
      :filtering="!!normalizedQuery"
      :expanded-ids="itemMatchIds"
      @unarchive="store.unarchiveChecklist"
      @delete="store.deleteChecklist"
    />
  </div>
</template>
