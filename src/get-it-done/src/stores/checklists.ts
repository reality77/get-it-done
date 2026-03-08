import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Checklist,
  ChecklistItem,
  ChecklistItemGroup,
  ChecklistItemId,
  ChecklistNode,
  ChecklistKind,
  TaskPriority,
  TaskEffort,
} from '../types'
import { usePlanMetaStore } from './planMeta'
import {
  walkNodes,
  findItemDeep,
  findGroupDeep,
  removeNodeDeep,
  cloneNodes,
  countItems,
  countDone,
} from '../composables/useTreeHelpers'
import { useSyncManager } from '../composables/useSyncManager'
import { useDayPlanning } from '../composables/useDayPlanning'

// Re-export for consumers that import SyncStatus from this module
export type { SyncStatus } from '../composables/useSyncManager'

// Re-export helpers used by components
export { countItems, countDone } from '../composables/useTreeHelpers'
export { getSnoozeOptions } from '../composables/useSnoozeOptions'

// ── Store ─────────────────────────────────────────────────────────────────────

export const useChecklistStore = defineStore('checklists', () => {
  const checklists = ref<Checklist[]>([])

  // Cache of _rev values to avoid extra reads on each write
  const revCache = new Map<string, string>()

  // ── Extracted modules ──────────────────────────────────────────────────────

  const sync = useSyncManager(checklists, revCache)
  const dayPlanning = useDayPlanning(checklists, sync.upsertChecklist)
  const planMetaStore = usePlanMetaStore()

  // ── Computed views ─────────────────────────────────────────────────────────

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

  // ── Checklist CRUD ──────────────────────────────────────────────────────────

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
    void sync.upsertChecklist(checklist)
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
    void sync.upsertChecklist(checklist)
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
    deletedIds.forEach(appId => void sync.removeFromLocal(appId))
  }

  function archiveChecklist(id: string): void {
    const checklist = getChecklist(id)
    if (!checklist) return
    checklist.archived = true
    checklist.archivedAt = new Date().toISOString()
    void sync.upsertChecklist(checklist)
  }

  function unarchiveChecklist(id: string): void {
    const checklist = getChecklist(id)
    if (!checklist) return
    checklist.archived = false
    checklist.archivedAt = null
    void sync.upsertChecklist(checklist)
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
    void sync.upsertChecklist(run)
    return run
  }

  // ── Task tracking: enable / disable ────────────────────────────────────────

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
    void sync.upsertChecklist(cl)
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
    void sync.upsertChecklist(cl)
  }

  // ── Item CRUD (tree-aware) ──────────────────────────────────────────────────

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
    void sync.upsertChecklist(checklist)
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
    void sync.upsertChecklist(checklist)
    return item
  }

  function updateItemText({ checklistId, itemId }: ChecklistItemId, text: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    const item = findItemDeep(checklist.items, itemId)
    if (!item) return
    item.text = text
    void sync.upsertChecklist(checklist)
  }

  function removeItem({ checklistId, itemId }: ChecklistItemId): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    checklist.items = removeNodeDeep(checklist.items, itemId)
    void sync.upsertChecklist(checklist)
  }

  // ── Group CRUD ──────────────────────────────────────────────────────────────

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
    void sync.upsertChecklist(checklist)
    return group
  }

  function updateGroupTitle(checklistId: string, groupId: string, title: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    const group = findGroupDeep(checklist.items, groupId)
    if (!group) return
    group.title = title
    void sync.upsertChecklist(checklist)
  }

  function toggleGroupCollapsed(checklistId: string, groupId: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    const group = findGroupDeep(checklist.items, groupId)
    if (!group) return
    group.collapsed = !group.collapsed
    void sync.upsertChecklist(checklist)
  }

  function removeGroup(checklistId: string, groupId: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    checklist.items = removeNodeDeep(checklist.items, groupId)
    void sync.upsertChecklist(checklist)
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    checklists,
    syncStatus: sync.syncStatus,
    planMeta: planMetaStore.planMeta,
    // Computed views
    activeChecklists,
    templates,
    archivedChecklists,
    getChecklist,
    // Task-tracking computed (from useDayPlanning)
    trackedItems: dayPlanning.trackedItems,
    activeTrackedItems: dayPlanning.activeTrackedItems,
    dayPlanItems: dayPlanning.dayPlanItems,
    snoozedItems: dayPlanning.snoozedItems,
    somedayItems: dayPlanning.somedayItems,
    dueSnoozedItems: dayPlanning.dueSnoozedItems,
    staleSnoozedItems: dayPlanning.staleSnoozedItems,
    itemsByPriority: dayPlanning.itemsByPriority,
    weeklyReviewDue: dayPlanning.weeklyReviewDue,
    isDayPlanFresh: dayPlanning.isDayPlanFresh,
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
    // Task-tracking actions (from useDayPlanning)
    enableTracking,
    disableTracking,
    setItemPriority: dayPlanning.setItemPriority,
    setItemEffort: dayPlanning.setItemEffort,
    snoozeItem: dayPlanning.snoozeItem,
    activateItem: dayPlanning.activateItem,
    sendItemToSomeday: dayPlanning.sendItemToSomeday,
    toggleItemDayPlan: dayPlanning.toggleItemDayPlan,
    setDayPlan: dayPlanning.setDayPlan,
    refreshDayPlanIfStale: dayPlanning.refreshDayPlanIfStale,
    processDueSnoozed: dayPlanning.processDueSnoozed,
    completeWeeklyReview: dayPlanning.completeWeeklyReview,
    suggestDayPlan: dayPlanning.suggestDayPlan,
    clearDayPlan: dayPlanning.clearDayPlan,
    // Sync
    loadLocal: sync.loadLocal,
    initSync: sync.initSync,
    unsubscribeRealtime: sync.unsubscribeRealtime,
  }
})
