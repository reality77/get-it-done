<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import type { ChecklistKind, TaskView } from './types'
import { useChecklistStore } from './stores/checklists'
import { useAuthStore } from './stores/auth'
import TabBar from './components/organisms/TabBar.vue'
import ActiveView from './components/templates/ActiveView.vue'
import TemplatesView from './components/templates/TemplatesView.vue'
import ArchiveView from './components/templates/ArchiveView.vue'
import TasksView from './components/templates/TasksView.vue'
import PasswordPrompt from './components/organisms/PasswordPrompt.vue'
import BottomNavBar from './components/organisms/BottomNavBar.vue'
import { storeToRefs } from 'pinia'

const activeTab = ref<'active' | 'templates' | 'archive' | 'tasks'>('tasks')

const newlyCreatedId = ref<string | null>(null)

const authStore = useAuthStore()
const checklistStore = useChecklistStore()

const loginPrompted = ref(false)

// ── Session keep-alive ────────────────────────────────────────────────────────

let keepAliveTimer: ReturnType<typeof setInterval> | null = null

function startKeepAlive(): void {
  // Only start keep-alive when the document is visible
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  if (keepAliveTimer) return
  keepAliveTimer = setInterval(async () => {
    // Stop keep-alive if user is no longer authenticated or page is hidden
    if (
      !authStore.isAuthenticated ||
      (typeof document !== 'undefined' && document.visibilityState !== 'visible')
    ) {
      stopKeepAlive()
      return
    }
    await authStore.checkSession()
  }, 5 * 60 * 1000)
}

function stopKeepAlive(): void {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }
}
const {
  activeChecklists,
  templates,
  archivedChecklists,
  syncStatus,
  weeklyReviewDue,
  dayPlanItems,
  snoozedItems,
  somedayItems,
  staleSnoozedItems,
  activeTrackedItems,
  itemsByPriority,
  isDayPlanFresh,
} = storeToRefs(checklistStore)

const {
  createChecklist,
  deleteChecklist,
  archiveChecklist,
  unarchiveChecklist,
  runTemplate,
} = checklistStore

// ── Task manager state ────────────────────────────────────────────────────────

const currentTaskView = ref<TaskView>('day')
const reviewDismissed = ref(false)

watch(weeklyReviewDue, (due) => {
  if (due) reviewDismissed.value = false
})

async function handleVisibilityChange(): Promise<void> {
  if (typeof document === 'undefined') return
  if (document.visibilityState === 'visible') {
    if (authStore.isAuthenticated) {
      startKeepAlive()
    }
    const result = await authStore.checkSession()
    if (result.status === 'expired') loginPrompted.value = true
  } else {
    stopKeepAlive()
  }
}

onMounted(async () => {
  await checklistStore.loadLocal()        // data available offline, before auth (#8)
  checklistStore.processDueSnoozed()      // now runs on real data (#4)
  checklistStore.refreshDayPlanIfStale()  // idem
  const result = await authStore.checkSession()
  if (authStore.isAuthenticated) {
    startKeepAlive()
    await checklistStore.initSync()
  } else if (result.status === 'expired') {
    loginPrompted.value = true
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopKeepAlive()
  checklistStore.unsubscribeRealtime()
})

watch(() => authStore.isAuthenticated, async (authed, wasAuthed) => {
  if (authed) {
    loginPrompted.value = false
    startKeepAlive()
    await checklistStore.initSync()
  } else {
    stopKeepAlive()
    checklistStore.unsubscribeRealtime()
    if (wasAuthed) loginPrompted.value = true  // session expired during use
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
    await nextTick()
    newlyCreatedId.value = null
}

function handleRunTemplate(checklistId: string): void {
  runTemplate(checklistId)
  activeTab.value = 'active'
}

function handleSuggestDay(): void {
  const suggested = checklistStore.suggestDayPlan()
  checklistStore.setDayPlan(suggested)
}

function handleCompleteReview(): void {
  checklistStore.completeWeeklyReview()
  reviewDismissed.value = true
}

const syncStatusClasses: Record<string, string> = {
  synced:       'bg-green-500',
  syncing:      'bg-violet-400 animate-pulse',
  offline:      'bg-zinc-600',
  pending:      'bg-orange-400',
  unauthorized: 'bg-red-500',
}

const syncStatusTitles: Record<string, string> = {
  synced:       'Synced',
  syncing:      'Syncing…',
  offline:      'Offline — retrying',
  pending:      'Unsynced changes',
  unauthorized: 'Session expired',
}
</script>

<template>
  <header class="mb-8 flex items-center justify-between">
    <h1 class="text-2xl font-semibold tracking-tight text-zinc-100">get-it-done</h1>
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
    :weekly-review-due="weeklyReviewDue"
    @change="activeTab = $event"
  />

  <main class="pb-20 md:pb-0">
    <TasksView
      v-if="activeTab === 'tasks'"
      :weekly-review-due="weeklyReviewDue"
      :review-dismissed="reviewDismissed"
      :snoozed-items="snoozedItems"
      :someday-items="somedayItems"
      :stale-snoozed-ids="staleSnoozedItems.map(r => r.item.id)"
      :day-items="dayPlanItems"
      :all-active-items="activeTrackedItems"
      :items-by-priority="itemsByPriority"
      :is-day-plan-fresh="isDayPlanFresh"
      :current-view="currentTaskView"
      @change-view="currentTaskView = $event"
      @activate="(id) => checklistStore.activateItem(id)"
      @snooze="(id, date) => checklistStore.snoozeItem(id, date)"
      @someday="(id) => checklistStore.sendItemToSomeday(id)"
      @delete="(id) => checklistStore.removeItem(id)"
      @update-priority="(id, p) => checklistStore.setItemPriority(id, p)"
      @update-effort="(id, e) => checklistStore.setItemEffort(id, e)"
      @update-text="(id, text) => checklistStore.updateItemText(id, text)"
      @toggle-done="(id) => checklistStore.toggleItem(id)"
      @suggest-day="handleSuggestDay"
      @toggle-day="(id) => checklistStore.toggleItemDayPlan(id)"
      @complete-review="handleCompleteReview"
      @dismiss-review="reviewDismissed = true"
      @clear="checklistStore.clearDayPlan()"
    />

    <ActiveView
      v-else-if="activeTab === 'active'"
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

  <BottomNavBar
    :activeTab="activeTab"
    :archiveCount="archivedChecklists.length"
    :weekly-review-due="weeklyReviewDue"
    @change="activeTab = $event"
  />

  <PasswordPrompt v-if="loginPrompted" @cancel="loginPrompted = false" />
</template>
