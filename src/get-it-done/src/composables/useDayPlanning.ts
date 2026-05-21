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
  DAY_PLAN_PRIORITY_SCORES,
  DAY_PLAN_EFFORT_UNITS,
  DAY_PLAN_EFFORT_BUDGET,
  DAY_PLAN_DEADLINE_BONUSES,
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

  // Tracks items the user manually removed from the day plan so Suggest skips
  // them on the next run. Keyed by "checklistId:itemId", value is expiry ms.
  const suggestDismissedUntil = new Map<string, number>()
  const DISMISS_DURATION_MS = 12 * 3600_000

  function clearDayPlan(): void {
    suggestDismissedUntil.clear()
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
    const key = `${ref.checklistId}:${ref.itemId}`
    if (item.selectedForToday) {
      suggestDismissedUntil.set(key, Date.now() + DISMISS_DURATION_MS)
    } else {
      suggestDismissedUntil.delete(key)
    }
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

  function deadlineBonus(deadline: string | null | undefined, today: string, effort: TaskEffort): number {
    if (!deadline) return 0
    const d = deadline.substring(0, 10)
    const b = DAY_PLAN_DEADLINE_BONUSES[effort]
    if (d < today) return b.overdue
    if (d === today) return b.today
    const daysAway = Math.ceil((new Date(d).getTime() - new Date(today).getTime()) / 86_400_000)
    if (daysAway === 1)  return b.tomorrow
    if (daysAway <= 7)   return b.week
    if (daysAway <= 14)  return b.twoWeeks
    if (daysAway <= 30)  return b.month
    if (daysAway <= 60)  return b.twoMonths
    return 0
  }

  function suggestDayPlan(): Array<ChecklistItemId> {
    const today = todayDateString()
    const now = Date.now()
    // Deadline threshold: overdue, due today, or due tomorrow are mandatory
    const tomorrow = new Date(new Date(today).getTime() + 86_400_000).toISOString().substring(0, 10)

    const mandatory: TrackedItemRef[] = []
    const optional: TrackedItemRef[] = []

    for (const r of activeTrackedItems.value) {
      const dl = r.item.deadline?.substring(0, 10)
      if (dl && dl <= tomorrow) {
        // Always include regardless of dismissal — deadline is imminent
        mandatory.push(r)
      } else {
        const key = `${r.checklistId}:${r.item.id}`
        const expiry = suggestDismissedUntil.get(key)
        if (!expiry || now >= expiry) optional.push(r)
      }
    }

    // Score and sort optional items
    const scoredOptional = optional.map(r => ({
      ref: r,
      units: DAY_PLAN_EFFORT_UNITS[r.item.effort ?? 'medium'],
      score: DAY_PLAN_PRIORITY_SCORES[r.item.priority ?? 'important']
           + deadlineBonus(r.item.deadline, today, r.item.effort ?? 'medium')
           + Math.random(),
    }))
    scoredOptional.sort((a, b) => b.score - a.score)

    // Mandatory items are always included; they may push over the budget
    const result: Array<ChecklistItemId> = mandatory.map(r => ({
      checklistId: r.checklistId,
      itemId: r.item.id,
    }))
    let budgetLeft = DAY_PLAN_EFFORT_BUDGET
    for (const r of mandatory) {
      budgetLeft -= DAY_PLAN_EFFORT_UNITS[r.item.effort ?? 'medium']
    }

    // Fill remaining budget with highest-scored optional items
    for (const s of scoredOptional) {
      if (budgetLeft <= 0) break
      if (s.units <= budgetLeft || result.length === 0) {
        result.push({ checklistId: s.ref.checklistId, itemId: s.ref.item.id })
        budgetLeft -= s.units
      }
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
