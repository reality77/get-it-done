import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Checklist,
  ChecklistItem,
  ChecklistItemGroup,
  ChecklistItemId,
  ChecklistNode,
  ChecklistKind,
  PlanMeta,
  TaskPriority,
  TaskEffort,
  TrackedItemRef,
} from '../types'
import { localDB, createRemoteDB, checklistToDoc, docToChecklist } from '../lib/couchdb'
import type { CouchDoc } from '../lib/couchdb'
import { useAuthStore } from './auth'

// ── Storage ───────────────────────────────────────────────────────────────────

const PLAN_META_KEY = 'make-it-done-plan-meta-v1'

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Snooze date helpers ───────────────────────────────────────────────────────

export function getSnoozeOptions(): Array<{ label: string; date: string }> {
  const today = new Date()
  const add = (days: number): string => {
    const d = new Date(today)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }
  const nextMonday = (): string => {
    const d = new Date(today)
    const dayOfWeek = d.getDay()
    const daysUntil = dayOfWeek === 1 ? 7 : ((8 - dayOfWeek) % 7 || 7)
    d.setDate(d.getDate() + daysUntil)
    return d.toISOString().slice(0, 10)
  }
  return [
    { label: 'Tomorrow',    date: add(1) },
    { label: 'In 3 days',   date: add(3) },
    { label: 'Next week',   date: add(7) },
    { label: 'Next Monday', date: nextMonday() },
  ]
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

function walkNodes(nodes: ChecklistNode[], visitor: (n: ChecklistNode) => void): void {
  for (const node of nodes) {
    visitor(node)
    if (node.type === 'group') walkNodes(node.children, visitor)
  }
}

function findItemDeep(nodes: ChecklistNode[], itemId: string): ChecklistItem | undefined {
  for (const node of nodes) {
    if (node.type === 'item' && node.id === itemId) return node
    if (node.type === 'group') {
      const found = findItemDeep(node.children, itemId)
      if (found) return found
    }
  }
  return undefined
}

function findGroupDeep(nodes: ChecklistNode[], groupId: string): ChecklistItemGroup | undefined {
  for (const node of nodes) {
    if (node.type === 'group' && node.id === groupId) return node
    if (node.type === 'group') {
      const found = findGroupDeep(node.children, groupId)
      if (found) return found
    }
  }
  return undefined
}

function removeNodeDeep(nodes: ChecklistNode[], targetId: string): ChecklistNode[] {
  return nodes
    .filter(n => n.id !== targetId)
    .map(n =>
      n.type === 'group'
        ? { ...n, children: removeNodeDeep(n.children, targetId) }
        : n
    )
}

function cloneNodes(nodes: ChecklistNode[]): ChecklistNode[] {
  return nodes.map(n => {
    if (n.type === 'item') {
      return { type: 'item' as const, id: crypto.randomUUID(), text: n.text, done: false }
    }
    return {
      type: 'group' as const,
      id: crypto.randomUUID(),
      title: n.title,
      collapsed: false,
      children: cloneNodes(n.children),
    }
  })
}

function loadPlanMeta(): PlanMeta {
  try {
    const raw = localStorage.getItem(PLAN_META_KEY)
    if (!raw) return { lastReviewedAt: null, dayPlanDate: null }
    return JSON.parse(raw) as PlanMeta
  } catch {
    return { lastReviewedAt: null, dayPlanDate: null }
  }
}

export function countItems(nodes: ChecklistNode[]): number {
  let count = 0
  walkNodes(nodes, n => { if (n.type === 'item') count++ })
  return count
}

export function countDone(nodes: ChecklistNode[]): number {
  let count = 0
  walkNodes(nodes, n => { if (n.type === 'item' && n.done) count++ })
  return count
}

// ── Data migration (handles old ChecklistItem[] without type field) ────────────

function migrateNodes(raw: unknown[]): ChecklistNode[] {
  return raw.map((n): ChecklistNode => {
    const node = n as Record<string, unknown>
    if (node.type === 'group') {
      return {
        type: 'group',
        id: String(node.id ?? crypto.randomUUID()),
        title: String(node.title ?? ''),
        collapsed: Boolean(node.collapsed ?? false),
        children: migrateNodes((node.children as unknown[]) ?? []),
      }
    }
    const item: ChecklistItem = {
      type: 'item',
      id: String(node.id ?? crypto.randomUUID()),
      text: String(node.text ?? ''),
      done: Boolean(node.done ?? false),
    }
    if (node.priority) item.priority = node.priority as TaskPriority
    if (node.effort) item.effort = node.effort as TaskEffort
    if (node.status) item.status = node.status as 'active' | 'snoozed' | 'someday'
    if (node.selectedForToday) item.selectedForToday = Boolean(node.selectedForToday)
    if (node.snoozeUntil !== undefined) item.snoozeUntil = node.snoozeUntil as string | null
    if (node.snoozedAt !== undefined) item.snoozedAt = node.snoozedAt as string | null
    if (node.completedAt !== undefined) item.completedAt = node.completedAt as string | null
    return item
  })
}

// ── Sync status type ──────────────────────────────────────────────────────────

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending'

// ── Store ─────────────────────────────────────────────────────────────────────

export const useChecklistStore = defineStore('checklists', () => {
  const checklists = ref<Checklist[]>([])
  const syncStatus = ref<SyncStatus>('offline')
  const planMeta = ref<PlanMeta>(loadPlanMeta())

  // Cache of _rev values to avoid extra reads on each write
  const revCache = new Map<string, string>()

  let syncHandler: PouchDB.Replication.Sync<CouchDoc> | null = null
  let changesHandler: PouchDB.Core.Changes<CouchDoc> | null = null
  let syncRetryTimer: ReturnType<typeof setTimeout> | null = null
  let syncRetryDelay = 5_000  // ms — reset on success, doubles on each failure up to 60 s
  // Sequence captured before allDocs — used to start the changes feed without gaps (#9)
  let lastSeq: string | number = 'now'
  let localLoaded = false

  // ── Plan meta persistence ────────────────────────────────────────────────────

  function persistPlanMeta(): void {
    localStorage.setItem(PLAN_META_KEY, JSON.stringify(planMeta.value))
  }

  // ── PouchDB helpers ───────────────────────────────────────────────────────────

  async function upsertChecklist(c: Checklist): Promise<void> {
    const doc = checklistToDoc(c)
    const rev = revCache.get(c.id)
    try {
      const result = await localDB.put(rev ? { ...doc, _rev: rev } : doc)
      revCache.set(c.id, result.rev)
    } catch (e) {
      if ((e as PouchDB.Core.Error).status === 409) {
        // Conflict: fetch fresh _rev and retry once
        const existing = await localDB.get(c.id)
        revCache.set(c.id, existing._rev)
        const result = await localDB.put({ ...doc, _rev: existing._rev })
        revCache.set(c.id, result.rev)
      }
    }
  }

  async function removeFromLocal(id: string): Promise<void> {
    const rev = revCache.get(id)
    try {
      if (rev) {
        await localDB.remove(id, rev)
      } else {
        const doc = await localDB.get(id)
        await localDB.remove(doc)
      }
      revCache.delete(id)
    } catch { /* already gone */ }
  }

  async function loadFromLocal(): Promise<void> {
    // Capture seq BEFORE allDocs to avoid missing concurrent writes (#9)
    const info = await localDB.info()
    lastSeq = info.update_seq
    const result = await localDB.allDocs<CouchDoc>({ include_docs: true })
    checklists.value = result.rows
      .filter(row => row.doc)
      .map(row => {
        revCache.set(row.id, row.doc!._rev)  // use doc._rev, not row.value.rev (#3)
        const doc = row.doc!
        return { ...docToChecklist(doc), items: migrateNodes(doc.items as unknown[]) }
      })
    localLoaded = true
  }

  // ── Computed views ───────────────────────────────────────────────────────────

  const activeChecklists = computed(() =>
    checklists.value
      .filter(c => c.kind !== 'template' && !c.archived)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  )

  const templates = computed(() =>
    checklists.value.filter(c => c.kind === 'template')
  )

  const archivedChecklists = computed(() =>
    checklists.value
      .filter(c => c.archived)
      .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
  )

  function getChecklist(id: string): Checklist | undefined {
    return checklists.value.find(c => c.id === id)
  }

  // ── Task-tracking: computed views ──────────────────────────────────────────

  function collectTrackedItems(): TrackedItemRef[] {
    const result: TrackedItemRef[] = []
    for (const cl of checklists.value) {
      if (!cl.tracked || cl.archived || cl.kind === 'template') continue
      const title = cl.runLabel ?? cl.title
      walkNodes(cl.items, n => {
        if (n.type === 'item') result.push({ item: n, checklistId: cl.id, checklistTitle: title })
      })
    }
    return result
  }

  const trackedItems = computed(() => collectTrackedItems())

  const activeTrackedItems = computed(() =>
    trackedItems.value.filter(r =>
      !r.item.done && (r.item.status ?? 'active') === 'active'
    )
  )

  const dayPlanItems = computed(() => {
    const today = todayDateString()
    const result: TrackedItemRef[] = []

    for (const r of trackedItems.value) {
      if ((r.item.status ?? 'active') !== 'active') continue
      if (r.item.selectedForToday && !r.item.done) result.push(r)
      else if (r.item.done && r.item.completedAt?.startsWith(today)) result.push(r)
    }

    for (const cl of checklists.value) {
      if (!cl.tracked || !cl.archived || cl.kind === 'template') continue
      const title = cl.runLabel ?? cl.title
      walkNodes(cl.items, n => {
        if (n.type === 'item' && n.done && n.completedAt?.startsWith(today)) {
          result.push({ item: n, checklistId: cl.id, checklistTitle: title })
        }
      })
    }

    return result
  })

  const snoozedItems = computed(() =>
    trackedItems.value.filter(r => (r.item.status ?? 'active') === 'snoozed')
  )

  const somedayItems = computed(() =>
    trackedItems.value.filter(r => (r.item.status ?? 'active') === 'someday')
  )

  const dueSnoozedItems = computed(() => {
    const today = todayDateString()
    return trackedItems.value.filter(r =>
      (r.item.status ?? 'active') === 'snoozed' && r.item.snoozeUntil != null && r.item.snoozeUntil <= today
    )
  })

  const staleSnoozedItems = computed(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    return trackedItems.value.filter(r => {
      if ((r.item.status ?? 'active') !== 'snoozed' || !r.item.snoozedAt) return false
      return new Date(r.item.snoozedAt) < cutoff
    })
  })

  const itemsByPriority = computed(() => ({
    urgent:    activeTrackedItems.value.filter(r => (r.item.priority ?? 'important') === 'urgent'),
    important: activeTrackedItems.value.filter(r => (r.item.priority ?? 'important') === 'important'),
    secondary: activeTrackedItems.value.filter(r => (r.item.priority ?? 'important') === 'secondary'),
  }))

  const weeklyReviewDue = computed((): boolean => {
    const today = new Date()
    const isMonday = today.getDay() === 1
    const hasDueSnoozed = dueSnoozedItems.value.length > 0
    const lastReview = planMeta.value.lastReviewedAt
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const overdueReview = !lastReview || new Date(lastReview) < sevenDaysAgo
    return isMonday || hasDueSnoozed || overdueReview
  })

  const isDayPlanFresh = computed(() =>
    planMeta.value.dayPlanDate === todayDateString()
  )

  function clearDayPlan(): void {
    for (const r of trackedItems.value) {
      if (r.item.selectedForToday) {
        r.item.selectedForToday = false
      }
    }
  }

  // ── Task-tracking: actions ────────────────────────────────────────────────

  function enableTracking(
    checklistId: string,
    defaultPriority: TaskPriority = 'important',
    defaultEffort: TaskEffort = 'medium',
  ): void {
    const cl = getChecklist(checklistId)
    if (!cl) return
    cl.tracked = true
    cl.defaultPriority = defaultPriority
    cl.defaultEffort = defaultEffort
    walkNodes(cl.items, n => {
      if (n.type === 'item') {
        n.priority = n.priority ?? defaultPriority
        n.effort = n.effort ?? defaultEffort
        n.status = n.status ?? 'active'
        n.selectedForToday = n.selectedForToday ?? false
        if (n.snoozeUntil === undefined) n.snoozeUntil = null
        if (n.snoozedAt === undefined) n.snoozedAt = null
        if (n.completedAt === undefined) n.completedAt = null
      }
    })
    void upsertChecklist(cl)
  }

  function disableTracking(checklistId: string): void {
    const cl = getChecklist(checklistId)
    if (!cl) return
    cl.tracked = false
    walkNodes(cl.items, n => {
      if (n.type === 'item') {
        delete n.priority
        delete n.effort
        delete n.status
        delete n.selectedForToday
        delete n.snoozeUntil
        delete n.snoozedAt
        delete n.completedAt
      }
    })
    void upsertChecklist(cl)
  }

  function setItemPriority({ checklistId, itemId }: ChecklistItemId, priority: TaskPriority): void {
    const cl = getChecklist(checklistId)
    if (!cl) return
    const item = findItemDeep(cl.items, itemId)
    if (!item) return
    item.priority = priority
    void upsertChecklist(cl)
  }

  function setItemEffort({ checklistId, itemId }: ChecklistItemId, effort: TaskEffort): void {
    const cl = getChecklist(checklistId)
    if (!cl) return
    const item = findItemDeep(cl.items, itemId)
    if (!item) return
    item.effort = effort
    void upsertChecklist(cl)
  }

  function snoozeItem({ checklistId, itemId }: ChecklistItemId, until: string): void {
    const cl = getChecklist(checklistId)
    if (!cl) return
    const item = findItemDeep(cl.items, itemId)
    if (!item) return
    item.status = 'snoozed'
    item.snoozeUntil = until
    if (!item.snoozedAt) item.snoozedAt = new Date().toISOString()
    item.selectedForToday = false
    void upsertChecklist(cl)
  }

  function activateItem({ checklistId, itemId }: ChecklistItemId): void {
    const cl = getChecklist(checklistId)
    if (!cl) return
    const item = findItemDeep(cl.items, itemId)
    if (!item) return
    item.status = 'active'
    item.snoozeUntil = null
    item.snoozedAt = null
    void upsertChecklist(cl)
  }

  function sendItemToSomeday({ checklistId, itemId }: ChecklistItemId): void {
    const cl = getChecklist(checklistId)
    if (!cl) return
    const item = findItemDeep(cl.items, itemId)
    if (!item) return
    item.status = 'someday'
    item.snoozeUntil = null
    item.snoozedAt = null
    item.selectedForToday = false
    void upsertChecklist(cl)
  }

  function toggleItemDayPlan({ checklistId, itemId }: ChecklistItemId): void {
    const cl = getChecklist(checklistId)
    if (!cl) return
    const item = findItemDeep(cl.items, itemId)
    if (!item || (item.status ?? 'active') !== 'active') return
    item.selectedForToday = !item.selectedForToday
    if (!planMeta.value.dayPlanDate) planMeta.value.dayPlanDate = todayDateString()
    persistPlanMeta()
    void upsertChecklist(cl)
  }

  function setDayPlan(itemKeys: Array<ChecklistItemId>): void {
    const keySet = new Set(itemKeys.map(k => `${k.checklistId}:${k.itemId}`))
    for (const cl of checklists.value) {
      if (!cl.tracked || cl.archived || cl.kind === 'template') continue
      let changed = false
      walkNodes(cl.items, n => {
        if (n.type === 'item') {
          const selected = keySet.has(`${cl.id}:${n.id}`)
          if (n.selectedForToday !== selected) {
            n.selectedForToday = selected
            changed = true
          }
        }
      })
      if (changed) void upsertChecklist(cl)
    }
    planMeta.value.dayPlanDate = todayDateString()
    persistPlanMeta()
  }

  function refreshDayPlanIfStale(): void {
    if (planMeta.value.dayPlanDate && planMeta.value.dayPlanDate !== todayDateString()) {
      for (const cl of checklists.value) {
        if (!cl.tracked) continue
        walkNodes(cl.items, n => {
          if (n.type === 'item') n.selectedForToday = false
        })
      }
      planMeta.value.dayPlanDate = null
      persistPlanMeta()
    }
  }

  function processDueSnoozed(): void {
    const today = todayDateString()
    for (const cl of checklists.value) {
      if (!cl.tracked || cl.archived) continue
      let changed = false
      walkNodes(cl.items, n => {
        if (n.type === 'item' && n.status === 'snoozed' && n.snoozeUntil && n.snoozeUntil <= today) {
          n.status = 'active'
          n.snoozeUntil = null
          n.snoozedAt = null
          changed = true
        }
      })
      if (changed) void upsertChecklist(cl)
    }
  }

  function completeWeeklyReview(): void {
    planMeta.value.lastReviewedAt = new Date().toISOString()
    persistPlanMeta()
  }

  function suggestDayPlan(): Array<ChecklistItemId> {
    const priorityScore: Record<TaskPriority, number> = { urgent: 30, important: 20, secondary: 10 }
    const effortScore: Record<TaskEffort, number> = { small: 3, medium: 2, large: 1 }

    type ScoredRef = { ref: TrackedItemRef; score: number; jitter: number }
    const scored: ScoredRef[] = activeTrackedItems.value.map(r => ({
      ref: r,
      score: priorityScore[r.item.priority ?? 'important'] + effortScore[r.item.effort ?? 'medium'],
      jitter: Math.random(),
    }))

    scored.sort((a, b) => b.score - a.score || b.jitter - a.jitter)

    const result: Array<ChecklistItemId> = []
    const remaining = scored.map(s => s.ref)
    let lastEffort: TaskEffort | null = null

    while (result.length < 5 && remaining.length > 0) {
      let idx = remaining.findIndex(r => (r.item.effort ?? 'medium') !== lastEffort)
      if (idx === -1) idx = 0
      const picked = remaining.splice(idx, 1)[0]
      if (!picked) break
      lastEffort = picked.item.effort ?? 'medium'
      result.push({ checklistId: picked.checklistId, itemId: picked.item.id })
    }

    return result
  }

  // ── PouchDB sync ─────────────────────────────────────────────────────────────

  function subscribeChanges(): void {
    if (changesHandler) return
    changesHandler = localDB.changes<CouchDoc>({
      since: lastSeq,  // seq captured before allDocs, no gap (#9)
      live: true,
      include_docs: true,
    })
    .on('change', (change) => {
      if (change.deleted) {
        checklists.value = checklists.value.filter(c => c.id !== change.id)
        revCache.delete(change.id)
      } else if (change.doc) {
        revCache.set(change.id, change.doc._rev)
        const cl = { ...docToChecklist(change.doc), items: migrateNodes(change.doc.items as unknown[]) }
        const idx = checklists.value.findIndex(c => c.id === change.id)
        if (idx >= 0) checklists.value[idx] = cl
        else checklists.value.push(cl)
      }
    })
  }

  // Start a single sync attempt (no built-in retry). On failure we schedule a
  // restart ourselves with exponential back-off to avoid flooding the console.
  function startSync(): void {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    // Clear any pending retry timer so we don't double-start.
    if (syncRetryTimer) { clearTimeout(syncRetryTimer); syncRetryTimer = null }
    // Cancel a stale handler if any.
    if (syncHandler) { syncHandler.cancel(); syncHandler = null }

    function scheduleRetry(): void {
      if (syncRetryTimer !== null) return  // already scheduled, don't double-fire
      syncStatus.value = 'offline'
      syncHandler?.cancel()
      syncHandler = null
      const delay = syncRetryDelay
      syncRetryDelay = Math.min(syncRetryDelay * 2, 60_000)
      syncRetryTimer = setTimeout(() => {
        syncRetryTimer = null
        startSync()
      }, delay)
    }

    // Intercept network failures at the fetch level (CORS/null status errors may
    // not surface through PouchDB events when retry is disabled).
    const remoteDB = createRemoteDB(() => { scheduleRetry() })
    syncStatus.value = 'syncing'

    syncHandler = localDB.sync(remoteDB, { live: true, retry: false })
      .on('paused', (err: unknown) => {
        if (err) {
          scheduleRetry()
        } else {
          // Successfully idle — reset back-off.
          syncRetryDelay = 5_000
          syncStatus.value = 'synced'
        }
      })
      .on('active', () => { syncStatus.value = 'syncing' })
      .on('error', () => { scheduleRetry() })
      .on('denied', () => { syncStatus.value = 'offline' })
  }

  async function initSync(): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || syncHandler) return

    // loadFromLocal() may have already run on app mount (offline/pre-auth case) (#8)
    if (!localLoaded) await loadFromLocal()
    subscribeChanges()

    startSync()
  }

  function unsubscribeRealtime(): void {
    if (syncRetryTimer) { clearTimeout(syncRetryTimer); syncRetryTimer = null }
    syncRetryDelay = 5_000
    syncHandler?.cancel()
    syncHandler = null
    changesHandler?.cancel()
    changesHandler = null
    syncStatus.value = 'offline'
  }

  // ── Checklist CRUD ────────────────────────────────────────────────────────────

  function createChecklist(
    kind: ChecklistKind,
    title: string,
    items: Omit<ChecklistItem, 'id'>[],
  ): Checklist {
    const checklist: Checklist = {
      id: crypto.randomUUID(),
      kind,
      title,
      items: items.map(i => ({ ...i, id: crypto.randomUUID() })),
      archived: false,
      createdAt: new Date().toISOString(),
      archivedAt: null,
      templateId: null,
      runLabel: null,
      tracked: false,
      defaultPriority: 'important',
      defaultEffort: 'medium',
    }
    checklists.value.push(checklist)
    void upsertChecklist(checklist)
    return checklist
  }

  function updateChecklist(
    id: string,
    patch: { title?: string; items?: ChecklistNode[] },
  ): void {
    const checklist = getChecklist(id)
    if (!checklist) return
    if (patch.title !== undefined) checklist.title = patch.title
    if (patch.items !== undefined) checklist.items = patch.items
    void upsertChecklist(checklist)
  }

  function deleteChecklist(id: string): void {
    const target = getChecklist(id)
    if (!target) return
    let deletedIds: string[]
    if (target.kind === 'template') {
      deletedIds = checklists.value
        .filter(c => c.id === id || c.templateId === id)
        .map(c => c.id)
      checklists.value = checklists.value.filter(
        c => c.id !== id && c.templateId !== id
      )
    } else {
      deletedIds = [id]
      checklists.value = checklists.value.filter(c => c.id !== id)
    }
    deletedIds.forEach(appId => void removeFromLocal(appId))
  }

  function archiveChecklist(id: string): void {
    const checklist = getChecklist(id)
    if (!checklist) return
    checklist.archived = true
    checklist.archivedAt = new Date().toISOString()
    void upsertChecklist(checklist)
  }

  function unarchiveChecklist(id: string): void {
    const checklist = getChecklist(id)
    if (!checklist) return
    checklist.archived = false
    checklist.archivedAt = null
    void upsertChecklist(checklist)
  }

  function runTemplate(templateId: string): Checklist {
    const template = getChecklist(templateId)
    if (!template) throw new Error(`Template ${templateId} not found`)
    const runCount = checklists.value.filter(c => c.templateId === templateId).length
    const run: Checklist = {
      id: crypto.randomUUID(),
      kind: 'run',
      title: template.title,
      items: cloneNodes(template.items),
      archived: false,
      createdAt: new Date().toISOString(),
      archivedAt: null,
      templateId,
      runLabel: `${template.title} — Run #${runCount + 1}`,
      tracked: false,
      defaultPriority: 'important',
      defaultEffort: 'medium',
    }
    checklists.value.push(run)
    void upsertChecklist(run)
    return run
  }

  // ── Item CRUD (tree-aware) ────────────────────────────────────────────────────

  function toggleItem({ checklistId, itemId }: ChecklistItemId): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    const item = findItemDeep(checklist.items, itemId)
    if (!item) return
    item.done = !item.done
    if (checklist.tracked) {
      if (item.done) {
        item.completedAt = new Date().toISOString()
      } else {
        item.completedAt = null
        item.selectedForToday = true
      }
    }
    if (
      checklist.kind !== 'template' &&
      countItems(checklist.items) > 0 &&
      countDone(checklist.items) === countItems(checklist.items)
    ) {
      checklist.archived = true
      checklist.archivedAt = new Date().toISOString()
    }
    void upsertChecklist(checklist)
  }

  function addItem(checklistId: string, text: string, parentGroupId?: string): ChecklistItem {
    const checklist = getChecklist(checklistId)
    if (!checklist) throw new Error(`Checklist ${checklistId} not found`)
    const item: ChecklistItem = { type: 'item', id: crypto.randomUUID(), text, done: false }
    if (checklist.tracked) {
      item.priority = checklist.defaultPriority
      item.effort = checklist.defaultEffort
      item.status = 'active'
      item.selectedForToday = false
      item.snoozeUntil = null
      item.snoozedAt = null
      item.completedAt = null
    }
    if (parentGroupId) {
      const group = findGroupDeep(checklist.items, parentGroupId)
      if (!group) throw new Error(`Group ${parentGroupId} not found`)
      group.children.push(item)
    } else {
      checklist.items.push(item)
    }
    void upsertChecklist(checklist)
    return item
  }

  function updateItemText({ checklistId, itemId }: ChecklistItemId, text: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    const item = findItemDeep(checklist.items, itemId)
    if (!item) return
    item.text = text
    void upsertChecklist(checklist)
  }

  function removeItem({ checklistId, itemId }: ChecklistItemId): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    checklist.items = removeNodeDeep(checklist.items, itemId)
    void upsertChecklist(checklist)
  }

  // ── Group CRUD ────────────────────────────────────────────────────────────────

  function addGroup(checklistId: string, title: string, parentGroupId?: string): ChecklistItemGroup {
    const checklist = getChecklist(checklistId)
    if (!checklist) throw new Error(`Checklist ${checklistId} not found`)
    const group: ChecklistItemGroup = {
      type: 'group',
      id: crypto.randomUUID(),
      title,
      collapsed: false,
      children: [],
    }
    if (parentGroupId) {
      const parent = findGroupDeep(checklist.items, parentGroupId)
      if (!parent) throw new Error(`Parent group ${parentGroupId} not found`)
      parent.children.push(group)
    } else {
      checklist.items.push(group)
    }
    void upsertChecklist(checklist)
    return group
  }

  function updateGroupTitle(checklistId: string, groupId: string, title: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    const group = findGroupDeep(checklist.items, groupId)
    if (!group) return
    group.title = title
    void upsertChecklist(checklist)
  }

  function toggleGroupCollapsed(checklistId: string, groupId: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    const group = findGroupDeep(checklist.items, groupId)
    if (!group) return
    group.collapsed = !group.collapsed
    void upsertChecklist(checklist)
  }

  function removeGroup(checklistId: string, groupId: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    checklist.items = removeNodeDeep(checklist.items, groupId)
    void upsertChecklist(checklist)
  }

  return {
    checklists,
    syncStatus,
    planMeta,
    activeChecklists,
    templates,
    archivedChecklists,
    getChecklist,
    // Task-tracking computed
    trackedItems,
    activeTrackedItems,
    dayPlanItems,
    snoozedItems,
    somedayItems,
    dueSnoozedItems,
    staleSnoozedItems,
    itemsByPriority,
    weeklyReviewDue,
    isDayPlanFresh,
    // Checklist CRUD
    createChecklist,
    updateChecklist,
    deleteChecklist,
    archiveChecklist,
    unarchiveChecklist,
    runTemplate,
    // Item CRUD
    toggleItem,
    addItem,
    updateItemText,
    removeItem,
    addGroup,
    updateGroupTitle,
    toggleGroupCollapsed,
    removeGroup,
    // Task-tracking actions
    enableTracking,
    disableTracking,
    setItemPriority,
    setItemEffort,
    snoozeItem,
    activateItem,
    sendItemToSomeday,
    toggleItemDayPlan,
    setDayPlan,
    refreshDayPlanIfStale,
    processDueSnoozed,
    completeWeeklyReview,
    suggestDayPlan,
    clearDayPlan,
    // Sync
    loadLocal: loadFromLocal,
    initSync,
    unsubscribeRealtime,
  }
})
