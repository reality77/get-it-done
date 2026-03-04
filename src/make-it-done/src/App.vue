<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import type { Checklist, ChecklistKind } from './types'
import { useChecklistStore } from './stores/checklists'
import { useAuthStore } from './stores/auth'
import TabBar from './components/organisms/TabBar.vue'
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
  createChecklist,
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

async function handleCreateChecklist(title: string, kind: ChecklistKind): Promise<void> {
    const created = createChecklist(
      kind,
      title,
      []
    )
    newlyCreatedId.value = created.id
    if (kind === 'template') activeTab.value = 'templates'
    formState.value = null
    await nextTick()
    newlyCreatedId.value = null
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
      @delete="deleteChecklist"
      @archive="archiveChecklist"
      @create="(name) => handleCreateChecklist(name, 'one-time')"
    />

    <TemplatesView
      v-else-if="activeTab === 'templates'"
      :templates="templates"
      :focus-checklist-id="newlyCreatedId"
      @delete="deleteChecklist"
      @run="handleRunTemplate"
      @create="(name) => handleCreateChecklist(name, 'template')"
    />

    <ArchiveView
      v-else-if="activeTab === 'archive'"
      :checklists="archivedChecklists"
      @unarchive="unarchiveChecklist"
      @delete="deleteChecklist"
    />
  </main>

  <PasswordPrompt v-if="loginPrompted" @cancel="loginPrompted = false" />
</template>
