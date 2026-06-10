<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import type { ChecklistKind } from './types'
import { useChecklistStore } from './stores/checklists'
import { useAuthStore } from './stores/auth'
import TabBar from './components/organisms/TabBar.vue'
import ActiveView from './components/templates/ActiveView.vue'
import DayView from './components/organisms/DayView.vue'
import WeekView from './components/organisms/WeekView.vue'
import BacklogView from './components/organisms/BacklogView.vue'
import WeeklyReviewPanel from './components/organisms/WeeklyReviewPanel.vue'
import PasswordPrompt from './components/organisms/PasswordPrompt.vue'
import BottomNavBar from './components/organisms/BottomNavBar.vue'
import NotificationSettings from './components/organisms/NotificationSettings.vue'
import StandaloneTaskFab from './components/molecules/StandaloneTaskFab.vue'
import { storeToRefs } from 'pinia'

const activeTab = ref<'today' | 'week' | 'backlog' | 'checklists'>('today')
const notificationsOpen = ref(false)

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
  syncStatus,
  writeError,
  weeklyReviewDue,
  dayPlanItems,
  snoozedItems,
  somedayItems,
  itemsByPriority,
  dismissedKeys,
} = storeToRefs(checklistStore)

const {
  createChecklist,
  deleteChecklist,
  archiveChecklist,
} = checklistStore

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
  checklistStore.ensureStandaloneChecklist()
  checklistStore.processDueSnoozed()       // now runs on real data (#4)
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
    const created = createChecklist(kind, title, [])
    newlyCreatedId.value = created.id
    await nextTick()
    newlyCreatedId.value = null
}

function handleCompleteReview(): void {
  checklistStore.completeWeeklyReview()
  reviewDismissed.value = true
}

const syncStatusClasses: Record<string, string> = {
  synced:       'bg-green-500',
  syncing:      'bg-primary animate-pulse',
  offline:      'bg-bg-3',
  pending:      'bg-secondary',
  unauthorized: 'bg-danger',
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
  <header class="pt-8 mb-8 flex items-center justify-between shrink-0">
    <h1 class="text-2xl font-semibold tracking-tight text-fg">get-it-done</h1>
    <div class="flex items-center gap-3">
      <button
        class="text-fg-4 hover:text-fg transition-colors"
        title="Notification settings"
        @click="notificationsOpen = true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>
      <span
        v-if="authStore.isAuthenticated"
        class="w-2 h-2 rounded-full shrink-0"
        :class="syncStatusClasses[syncStatus]"
        :title="syncStatusTitles[syncStatus]"
      />
      <button v-else
        class="text-fg-3 hover:text-fg transition-colors"
        @click="loginPrompted = true">
        Log in
      </button>
    </div>
  </header>

  <TabBar
    class="shrink-0"
    :activeTab="activeTab"
    :weekly-review-due="weeklyReviewDue"
    @change="activeTab = $event"
  />

  <main class="flex-1 overflow-hidden flex flex-col min-h-0">
    <WeeklyReviewPanel
      v-if="activeTab !== 'checklists' && weeklyReviewDue && !reviewDismissed"
      class="shrink-0"
      @complete-review="handleCompleteReview"
      @dismiss="reviewDismissed = true"
    />

    <div v-if="activeTab === 'today'" class="flex-1 overflow-y-auto pb-20 md:pb-0">
      <DayView :items="dayPlanItems" />
    </div>

    <div v-else-if="activeTab === 'week'" class="flex-1 overflow-y-auto pb-20 md:pb-0">
      <WeekView
        :items-by-priority="itemsByPriority"
        :dismissed-keys="dismissedKeys"
      />
    </div>

    <BacklogView
      v-else-if="activeTab === 'backlog'"
      class="flex-1 overflow-hidden"
      :snoozed-items="snoozedItems"
      :someday-items="somedayItems"
    />

    <div v-else-if="activeTab === 'checklists'" class="flex-1 overflow-y-auto pb-20 md:pb-0">
      <ActiveView
        :checklists="activeChecklists"
        :focus-checklist-id="newlyCreatedId"
        @delete="deleteChecklist"
        @archive="archiveChecklist"
        @create="(name) => handleCreateChecklist(name, 'one-time')"
      />
    </div>
  </main>

  <BottomNavBar
    :activeTab="activeTab"
    :weekly-review-due="weeklyReviewDue"
    @change="activeTab = $event"
  />

  <StandaloneTaskFab v-if="activeTab !== 'checklists'" :active-tab="activeTab" />

  <PasswordPrompt v-if="loginPrompted" @cancel="loginPrompted = false" />
  <NotificationSettings v-if="notificationsOpen" @close="notificationsOpen = false" />

  <div
    v-if="writeError"
    class="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-danger/20 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-start gap-3 z-50 shadow-lg"
    role="alert"
  >
    <span class="text-sm flex-1">{{ writeError }}</span>
    <button
      class="text-danger hover:text-red-200 transition-colors shrink-0 text-lg leading-none"
      aria-label="Dismiss"
      @click="checklistStore.clearWriteError()"
    >×</button>
  </div>
</template>
