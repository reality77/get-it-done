<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { Checklist, ChecklistKind, ChecklistNode } from './types'
import { useChecklists } from './composables/useChecklists'
import TabBar from './components/organisms/TabBar.vue'
import ChecklistForm from './components/organisms/ChecklistForm.vue'
import ActiveView from './components/templates/ActiveView.vue'
import TemplatesView from './components/templates/TemplatesView.vue'
import ArchiveView from './components/templates/ArchiveView.vue'

const activeTab = ref<'active' | 'templates' | 'archive'>('active')

const formState = ref<{
  checklist: Checklist | null
  defaultKind: 'one-time' | 'template'
} | null>(null)

const newlyCreatedId = ref<string | null>(null)

const {
  activeChecklists,
  templates,
  archivedChecklists,
  getChecklist,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  archiveChecklist,
  unarchiveChecklist,
  runTemplate,
} = useChecklists()

function openCreateForm(kind: 'one-time' | 'template'): void {
  formState.value = { checklist: null, defaultKind: kind }
}

function openEditForm(checklistId: string): void {
  const found = getChecklist(checklistId)
  if (!found) return
  formState.value = {
    checklist: found,
    defaultKind: found.kind === 'template' ? 'template' : 'one-time',
  }
}

async function handleFormSave(payload: {
  id: string | null
  kind: ChecklistKind
  title: string
  items: { id: string | null; type: 'item'; text: string; done: boolean }[]
  nodes: ChecklistNode[] | null
}): Promise<void> {
  if (payload.id === null) {
    const created = createChecklist(
      payload.kind,
      payload.title,
      payload.items.map(({ text, done }) => ({ type: 'item' as const, text, done })),
    )
    newlyCreatedId.value = created.id
    if (payload.kind === 'template') activeTab.value = 'templates'
    formState.value = null
    await nextTick()
    newlyCreatedId.value = null
  } else {
    updateChecklist(payload.id, {
      title: payload.title,
      items: payload.nodes ?? payload.items.map(i => ({
        type: 'item' as const,
        id: i.id ?? crypto.randomUUID(),
        text: i.text,
        done: i.done,
      })),
    })
    formState.value = null
  }
}

function handleRunTemplate(checklistId: string): void {
  runTemplate(checklistId)
  activeTab.value = 'active'
}
</script>

<template>
  <header class="mb-8">
    <h1 class="text-2xl font-semibold tracking-tight text-zinc-100">make-it-done</h1>
  </header>

  <TabBar
    :activeTab="activeTab"
    :archiveCount="archivedChecklists.length"
    @change="activeTab = $event"
  />

  <main>
    <ActiveView
      v-if="activeTab === 'active'"
      :checklists="activeChecklists"
      :focus-checklist-id="newlyCreatedId"
      @edit="openEditForm"
      @delete="deleteChecklist"
      @archive="archiveChecklist"
      @create="openCreateForm('one-time')"
      @create-template="openCreateForm('template')"
    />

    <TemplatesView
      v-else-if="activeTab === 'templates'"
      :templates="templates"
      :focus-checklist-id="newlyCreatedId"
      @edit="openEditForm"
      @delete="deleteChecklist"
      @run="handleRunTemplate"
      @create="openCreateForm('template')"
    />

    <ArchiveView
      v-else-if="activeTab === 'archive'"
      :checklists="archivedChecklists"
      @unarchive="unarchiveChecklist"
      @delete="deleteChecklist"
    />
  </main>

  <ChecklistForm
    v-if="formState !== null"
    :key="formState.checklist?.id ?? 'new'"
    :checklist="formState.checklist"
    :defaultKind="formState.defaultKind"
    @save="handleFormSave"
    @cancel="formState = null"
  />
</template>
