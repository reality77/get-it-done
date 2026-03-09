import { computed } from 'vue'
import type { Ref } from 'vue'
import type {
  Checklist,
  ChecklistItem,
  ChecklistItemId,
  TrackedItemRef,
  TaskPriority,
  TaskEffort,
} from '../types'
import { usePlanMetaStore } from '../stores/planMeta'
import {
  walkNodes,
  findItemDeep,
  todayDateString,
} from './useTreeHelpers'
import {
  DAY_PLAN_MAX_ITEMS,
  DAY_PLAN_PRIORITY_SCORES,
  DAY_PLAN_EFFORT_SCORES,
  STALE_SNOOZE_DAYS,
  WEEKLY_REVIEW_INTERVAL_DAYS,
} from '../config/constants'

export function useDayPlanning(
  checklists: Ref<Checklist[]>,
  upsertChecklist: (c: Checklist) => Promise<void>,
) {
  const planMetaStore = usePlanMetaStore()
  const planMeta = planMetaStore.planMeta

  // ── Private helpers ─────────────────────────────────────────────────────────

  function getChecklist(id: string): Checklist | undefined {
    return checklists.value.find(c => c.id === id)
  }

  /** Shared 4-line boilerplate: find checklist + item, mutate, persist */
  function withItem(ref: ChecklistItemId, fn: (item: ChecklistItem) => void): void {
    const cl = getChecklist(ref.checklistId)
    if (!cl) return
    const item = findItemDeep(cl.items, ref.itemId)
    if (!item) return
    fn(item)
    void upsertChecklist(cl)
  }

  // ── Tracked items ───────────────────────────────────────────────────────────

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

  // ── Day plan computed ───────────────────────────────────────────────────────

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

  // ── Snooze / status computed ────────────────────────────────────────────────

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
    cutoff.setDate(cutoff.getDate() - STALE_SNOOZE_DAYS)
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

  // ── Weekly review computed ──────────────────────────────────────────────────

  const weeklyReviewDue = computed((): boolean => {
    const today = new Date()
    const isMonday = today.getDay() === 1
    const hasDueSnoozed = dueSnoozedItems.value.length > 0
    const lastReview = planMeta.lastReviewedAt
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - WEEKLY_REVIEW_INTERVAL_DAYS)
    const overdueReview = !lastReview || new Date(lastReview) < cutoff
    return isMonday || hasDueSnoozed || overdueReview
  })

  const isDayPlanFresh = computed(() =>
    planMeta.dayPlanDate === todayDateString()
  )

  // ── Day plan actions ────────────────────────────────────────────────────────

  function clearDayPlan(): void {
    for (const r of trackedItems.value) {
      if (r.item.selectedForToday) {
        r.item.selectedForToday = false
      }
    }
  }

  function toggleItemDayPlan(ref: ChecklistItemId): void {
    const cl = getChecklist(ref.checklistId)
    if (!cl) return
    const item = findItemDeep(cl.items, ref.itemId)
    if (!item || (item.status ?? 'active') !== 'active') return
    item.selectedForToday = !item.selectedForToday
    if (!planMeta.dayPlanDate) planMeta.dayPlanDate = todayDateString()
    planMetaStore.persistPlanMeta()
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
    planMeta.dayPlanDate = todayDateString()
    planMetaStore.persistPlanMeta()
  }

  function refreshDayPlanIfStale(): void {
    if (planMeta.dayPlanDate && planMeta.dayPlanDate !== todayDateString()) {
      for (const cl of checklists.value) {
        if (!cl.tracked) continue
        walkNodes(cl.items, n => {
          if (n.type === 'item') n.selectedForToday = false
        })
      }
      planMeta.dayPlanDate = null
      planMetaStore.persistPlanMeta()
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
    planMeta.lastReviewedAt = new Date().toISOString()
    planMetaStore.persistPlanMeta()
  }

  function suggestDayPlan(): Array<ChecklistItemId> {
    type ScoredRef = { ref: TrackedItemRef; score: number; jitter: number }
    const scored: ScoredRef[] = activeTrackedItems.value.map(r => ({
      ref: r,
      score: DAY_PLAN_PRIORITY_SCORES[r.item.priority ?? 'important'] + DAY_PLAN_EFFORT_SCORES[r.item.effort ?? 'medium'],
      jitter: Math.random(),
    }))

    scored.sort((a, b) => b.score - a.score || b.jitter - a.jitter)

    const result: Array<ChecklistItemId> = []
    const remaining = scored.map(s => s.ref)
    let lastEffort: TaskEffort | null = null

    while (result.length < DAY_PLAN_MAX_ITEMS && remaining.length > 0) {
      let idx = remaining.findIndex(r => (r.item.effort ?? 'medium') !== lastEffort)
      if (idx === -1) idx = 0
      const picked = remaining.splice(idx, 1)[0]
      if (!picked) break
      lastEffort = picked.item.effort ?? 'medium'
      result.push({ checklistId: picked.checklistId, itemId: picked.item.id })
    }

    return result
  }

  // ── Item task-tracking mutations ────────────────────────────────────────────

  function setItemPriority(ref: ChecklistItemId, priority: TaskPriority): void {
    withItem(ref, item => { item.priority = priority })
  }

  function setItemEffort(ref: ChecklistItemId, effort: TaskEffort): void {
    withItem(ref, item => { item.effort = effort })
  }

  function snoozeItem(ref: ChecklistItemId, until: string): void {
    withItem(ref, item => {
      item.status = 'snoozed'
      item.snoozeUntil = until
      if (!item.snoozedAt) item.snoozedAt = new Date().toISOString()
      item.selectedForToday = false
    })
  }

  function activateItem(ref: ChecklistItemId): void {
    withItem(ref, item => {
      item.status = 'active'
      item.snoozeUntil = null
      item.snoozedAt = null
    })
  }

  function sendItemToSomeday(ref: ChecklistItemId): void {
    withItem(ref, item => {
      item.status = 'someday'
      item.snoozeUntil = null
      item.snoozedAt = null
      item.selectedForToday = false
    })
  }

  return {
    planMeta,
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
    clearDayPlan,
    toggleItemDayPlan,
    setDayPlan,
    refreshDayPlanIfStale,
    processDueSnoozed,
    completeWeeklyReview,
    suggestDayPlan,
    setItemPriority,
    setItemEffort,
    snoozeItem,
    activateItem,
    sendItemToSomeday,
  }
}
