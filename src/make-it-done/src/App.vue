<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import type { Checklist, ChecklistKind, ChecklistNode } from './types'
import { useChecklistStore } from './stores/checklists'
import { useAuthStore } from './stores/auth'
import TabBar from './components/organisms/TabBar.vue'
import ChecklistForm from './components/organisms/ChecklistForm.vue'
import ActiveView from './components/templates/ActiveView.vue'
import TemplatesView from './components/templates/TemplatesView.vue'
import ArchiveView from './components/templates/ArchiveView.vue'
import PasswordPrompt from './components/organisms/PasswordPrompt.vue'
import { storeToRefs } from 'pinia'

const activeTab = ref<'active' | 'templates' | 'archive'>('active')

const formState = ref<{
  checklist: Checklist | null
  defaultKind: 'one-time' | 'template'
} | null>(null)

const newlyCreatedId = ref<string | null>(null)

const authStore = useAuthStore()
const checklistStore = useChecklistStore()

const loginPrompted = ref(false)

const {
  activeChecklists,
  templates,
  archivedChecklists,
  syncStatus,
} = storeToRefs(checklistStore)

const {
  getChecklist,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  archiveChecklist,
  unarchiveChecklist,
  runTemplate,
} = checklistStore

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await checklistStore.initSync()
  }
})

onUnmounted(() => {
  checklistStore.unsubscribeRealtime()
})

watch(() => authStore.isAuthenticated, async (authed) => {
  if (authed) {
    await checklistStore.initSync()
  } else {
    checklistStore.unsubscribeRealtime()
  }
})

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

const syncStatusClasses: Record<string, string> = {
  synced:  'bg-green-500',
  syncing: 'bg-violet-400 animate-pulse',
  offline: 'bg-zinc-600',
  pending: 'bg-orange-400',
}

const syncStatusTitles: Record<string, string> = {
  synced:  'Synced',
  syncing: 'Syncing…',
  offline: 'Offline — retrying',
  pending: 'Unsynced changes',
}
</script>

<template>
  <header class="mb-8 flex items-center justify-between">
    <h1 class="text-2xl font-semibold tracking-tight text-zinc-100">make-it-done</h1>
    <span
      v-if="authStore.isAuthenticated"
      class="w-2 h-2 rounded-full shrink-0"
      :class="syncStatusClasses[syncStatus]"
      :title="syncStatusTitles[syncStatus]"
    />
    <button v-else 
      class="text-zinc-400 hover:text-zinc-200 transition-colors"
      @click="loginPrompted = true">
      Log in
    </button>
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

  <PasswordPrompt v-if="loginPrompted" @cancel="loginPrompted = false" />
</template>
