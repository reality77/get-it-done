<script setup lang="ts">
import { ref } from 'vue'
import type { Checklist, ChecklistKind } from './types'
import { useChecklists } from './composables/useChecklists'
import TabBar from './components/organisms/TabBar.vue'
import ChecklistForm from './components/organisms/ChecklistForm.vue'
import ActiveView from './components/templates/ActiveView.vue'

const activeTab = ref<'active' | 'templates' | 'archive'>('active')

const formState = ref<{
  checklist: Checklist | null
  defaultKind: 'one-time' | 'template'
} | null>(null)

const {
  activeChecklists,
  archivedChecklists,
  allChecklists,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  toggleItem,
  archiveChecklist,
  addItem,
  updateItemText,
  removeItem,
} = useChecklists()

function openCreateForm(kind: 'one-time' | 'template'): void {
  formState.value = { checklist: null, defaultKind: kind }
}

function openEditForm(checklistId: string): void {
  const found = allChecklists.value.find(c => c.id === checklistId)
  if (!found) return
  formState.value = {
    checklist: found,
    defaultKind: found.kind === 'template' ? 'template' : 'one-time',
  }
}

function handleFormSave(payload: {
  id: string | null
  kind: ChecklistKind
  title: string
  items: { text: string; done: boolean }[]
}): void {
  if (payload.id === null) {
    createChecklist(payload.kind, payload.title, payload.items)
  } else {
    updateChecklist(payload.id, {
      title: payload.title,
      items: payload.items.map(i => ({
        id: crypto.randomUUID(),
        text: i.text,
        done: i.done,
      })),
    })
  }
  formState.value = null
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
      @toggle-item="toggleItem"
      @add-item="addItem"
      @update-item-text="updateItemText"
      @remove-item="removeItem"
      @edit="openEditForm"
      @delete="deleteChecklist"
      @archive="archiveChecklist"
      @create="openCreateForm('one-time')"
    />

    <p v-else-if="activeTab === 'templates'" class="text-center text-zinc-600 py-12 text-sm">
      Templates — coming soon.
    </p>

    <p v-else-if="activeTab === 'archive'" class="text-center text-zinc-600 py-12 text-sm">
      Archive — coming soon.
    </p>
  </main>

  <ChecklistForm
    v-if="formState !== null"
    :checklist="formState.checklist"
    :defaultKind="formState.defaultKind"
    @save="handleFormSave"
    @cancel="formState = null"
  />
</template>
