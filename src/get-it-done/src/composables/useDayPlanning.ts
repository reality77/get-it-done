import { computed, reactive } from 'vue'
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
  toLocalDateString,
  parseLocalDate,
  countItems,
  countDone,
} from './useTreeHelpers'
import {
  DAY_PLAN_PRIORITY_SCORES,
  DAY_PLAN_EFFORT_UNITS,
  DAY_PLAN_EFFORT_BUDGET,
  DAY_PLAN_DEADLINE_BONUSES,
  DAY_PLAN_DISMISS_DURATION_MS,
  STALE_SNOOZE_DAYS,
  WEEKLY_REVIEW_INTERVAL_DAYS,
} from '../config/constants'

// ── Module-level pure helpers ────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, important: 1, secondary: 2 }

function itemKey(checklistId: string, itemId: string): string {
  return `${checklistId}:${itemId}`
}

const completedToday = (iso: string | null | undefined, today: string): boolean =>
  iso != null && toLocalDateString(new Date(iso)) === today

function getMondayDateString(): string {
  const d = new Date()
  const day = d.getDay()
  const daysToMonday = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + daysToMonday)
  return toLocalDateString(d)
}

function deadlineBonus(deadline: string | null | undefined, today: string, effort: TaskEffort): number {
  if (!deadline) return 0
  const d = deadline.substring(0, 10)
  const b = DAY_PLAN_DEADLINE_BONUSES[effort]
  if (d < today) return b.overdue
  if (d === today) return b.today
  const daysAway = Math.ceil((parseLocalDate(d).getTime() - parseLocalDate(today).getTime()) / 86_400_000)
  if (daysAway === 1)  return b.tomorrow
  if (daysAway <= 7)   return b.week
  if (daysAway <= 14)  return b.twoWeeks
  if (daysAway <= 30)  return b.month
  if (daysAway <= 60)  return b.twoMonths
  return 0
}

function scoreItem(r: TrackedItemRef, today: string): number {
  const effort = r.item.effort ?? 'medium'
  return DAY_PLAN_PRIORITY_SCORES[r.item.priority ?? 'important']
       + deadlineBonus(r.item.deadline, today, effort)
       + Math.random()
}

function effortUnits(r: TrackedItemRef): number {
  return DAY_PLAN_EFFORT_UNITS[r.item.effort ?? 'medium']
}

// ── Composable ───────────────────────────────────────────────────────────────

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
      if (cl.kind === 'template') continue
      const title = cl.runLabel ?? cl.title

      if (cl.trackMode === 'items') {
        if (cl.archived) continue
        walkNodes(cl.items, n => {
          if (n.type === 'item') result.push({ item: n, checklistId: cl.id, checklistTitle: title })
        })
      } else if (cl.trackMode === 'checklist') {
        const total = countItems(cl.items)
        const done = countDone(cl.items)
        const syntheticItem: ChecklistItem = {
          type: 'item',
          id: cl.id,
          text: title,
          done: cl.archived,
          priority: cl.priority,
          effort: cl.effort,
          status: cl.status ?? 'active',
          selectedForToday: cl.selectedForToday ?? false,
          selectedForWeek: cl.selectedForWeek ?? false,
          snoozeUntil: cl.snoozeUntil ?? null,
          snoozedAt: cl.snoozedAt ?? null,
          completedAt: cl.archived ? (cl.archivedAt ?? null) : null,
          deadline: cl.deadline,
          reminders: cl.reminders,
          comment: cl.comment,
          url: cl.url,
        }
        result.push({
          item: syntheticItem,
          checklistId: cl.id,
          checklistTitle: title,
          isChecklistTask: true,
          progress: { done, total },
        })
      }
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

  // Items completed today that belong to archived tracked checklists.
  // Kept separate from trackedItems (which excludes archived) so dayPlanItems
  // can show today's completions even after a checklist auto-archives.
  const archivedTodayItems = computed(() => {
    const today = todayDateString()
    const result: TrackedItemRef[] = []
    for (const cl of checklists.value) {
      if (!cl.archived || cl.kind === 'template') continue
      const title = cl.runLabel ?? cl.title

      if (cl.trackMode === 'items') {
        walkNodes(cl.items, n => {
          if (n.type === 'item' && n.done && completedToday(n.completedAt, today)) {
            result.push({ item: n, checklistId: cl.id, checklistTitle: title })
          }
        })
      } else if (cl.trackMode === 'checklist' && completedToday(cl.archivedAt, today) && cl.selectedForToday) {
        const total = countItems(cl.items)
        const done = countDone(cl.items)
        result.push({
          item: {
            type: 'item', id: cl.id, text: title, done: true,
            priority: cl.priority, effort: cl.effort, status: cl.status ?? 'active',
            selectedForToday: true, selectedForWeek: cl.selectedForWeek ?? false,
            snoozeUntil: null, snoozedAt: null, completedAt: cl.archivedAt ?? null,
            deadline: cl.deadline, reminders: cl.reminders,
            comment: cl.comment, url: cl.url,
          },
          checklistId: cl.id,
          checklistTitle: title,
          isChecklistTask: true,
          progress: { done, total },
        })
      }
    }
    return result
  })

  const dayPlanItems = computed(() => {
    const today = todayDateString()
    const fromActive = trackedItems.value.filter(r => {
      if ((r.item.status ?? 'active') !== 'active') return false
      if (r.item.selectedForToday && !r.item.done) return true
      return r.item.done && completedToday(r.item.completedAt, today)
    })
    return [...fromActive, ...archivedTodayItems.value]
  })

  // ── Snooze / status computed ────────────────────────────────────────────────

  const snoozedItems = computed(() =>
    trackedItems.value
      .filter(r => (r.item.status ?? 'active') === 'snoozed')
      .sort((a, b) => {
        const da = a.item.snoozeUntil ?? '￿'
        const db = b.item.snoozeUntil ?? '￿'
        if (da !== db) return da < db ? -1 : 1
        const pa = PRIORITY_ORDER[a.item.priority ?? 'secondary'] ?? 2
        const pb = PRIORITY_ORDER[b.item.priority ?? 'secondary'] ?? 2
        return pa - pb
      })
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
    if (trackedItems.value.length === 0) return false
    const today = new Date()
    const isMonday = today.getDay() === 1
    const hasStaleSnoozed = staleSnoozedItems.value.length > 0
    const lastReview = planMeta.lastReviewedAt
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - WEEKLY_REVIEW_INTERVAL_DAYS)
    const overdueReview = !lastReview || new Date(lastReview) < cutoff
    const reviewedThisWeek = lastReview != null && lastReview.substring(0, 10) >= getMondayDateString()
    return (isMonday && !reviewedThisWeek) || hasStaleSnoozed || overdueReview
  })

  const isDayPlanFresh = computed(() =>
    planMeta.dayPlanDate === todayDateString()
  )

  // ── Day plan actions ────────────────────────────────────────────────────────

  // Items the user manually removed — excluded from Suggest for 12 h.
  // Keyed by itemKey(); value is the expiry timestamp.
  // Reactive so dismissedKeys computed re-evaluates on each change.
  const dismissedUntil = reactive<Record<string, number>>({})

  const dismissedKeys = computed((): Set<string> => {
    const now = Date.now()
    return new Set(Object.keys(dismissedUntil).filter(k => dismissedUntil[k]! > now))
  })

  function clearDayPlan(): void {
    for (const k in dismissedUntil) delete dismissedUntil[k]
    for (const cl of checklists.value) {
      if (cl.archived || cl.kind === 'template') continue
      let changed = false
      if (cl.trackMode === 'items') {
        walkNodes(cl.items, n => {
          if (n.type === 'item' && n.selectedForToday) {
            n.selectedForToday = false
            changed = true
          }
        })
      } else if (cl.trackMode === 'checklist' && cl.selectedForToday) {
        cl.selectedForToday = false
        changed = true
      }
      if (changed) void upsertChecklist(cl)
    }
  }

  function toggleItemDayPlan(ref: ChecklistItemId): void {
    const cl = getChecklist(ref.checklistId)
    if (!cl) return
    const key = itemKey(ref.checklistId, ref.itemId)

    if (cl.trackMode === 'checklist' && ref.itemId === ref.checklistId) {
      if ((cl.status ?? 'active') !== 'active') return
      if (cl.selectedForToday) {
        dismissedUntil[key] = Date.now() + DAY_PLAN_DISMISS_DURATION_MS
      } else {
        delete dismissedUntil[key]
      }
      cl.selectedForToday = !cl.selectedForToday
    } else {
      const item = findItemDeep(cl.items, ref.itemId)
      if (!item || (item.status ?? 'active') !== 'active') return
      if (item.selectedForToday) {
        dismissedUntil[key] = Date.now() + DAY_PLAN_DISMISS_DURATION_MS
      } else {
        delete dismissedUntil[key]
      }
      item.selectedForToday = !item.selectedForToday
    }

    if (!planMeta.dayPlanDate) planMeta.dayPlanDate = todayDateString()
    planMetaStore.persistPlanMeta()
    void upsertChecklist(cl)
  }

  function setDayPlan(itemKeys: Array<ChecklistItemId>): void {
    const keySet = new Set(itemKeys.map(k => itemKey(k.checklistId, k.itemId)))
    for (const cl of checklists.value) {
      if (cl.archived || cl.kind === 'template') continue
      let changed = false

      if (cl.trackMode === 'items') {
        walkNodes(cl.items, n => {
          if (n.type === 'item') {
            const selected = keySet.has(itemKey(cl.id, n.id))
            if (n.selectedForToday !== selected) {
              n.selectedForToday = selected
              changed = true
            }
          }
        })
      } else if (cl.trackMode === 'checklist') {
        const selected = keySet.has(itemKey(cl.id, cl.id))
        if (cl.selectedForToday !== selected) {
          cl.selectedForToday = selected
          changed = true
        }
      }

      if (changed) void upsertChecklist(cl)
    }
    planMeta.dayPlanDate = todayDateString()
    planMetaStore.persistPlanMeta()
  }

  function refreshDayPlanIfStale(): void {
    if (planMeta.dayPlanDate && planMeta.dayPlanDate !== todayDateString()) {
      for (const cl of checklists.value) {
        let changed = false
        if (cl.trackMode === 'items') {
          walkNodes(cl.items, n => {
            if (n.type === 'item' && n.selectedForToday) {
              n.selectedForToday = false
              changed = true
            }
          })
        } else if (cl.trackMode === 'checklist' && cl.selectedForToday) {
          cl.selectedForToday = false
          changed = true
        }
        if (changed) void upsertChecklist(cl)
      }
      planMeta.dayPlanDate = null
      planMetaStore.persistPlanMeta()
    }
  }

  function processDueSnoozed(): void {
    const today = todayDateString()
    for (const cl of checklists.value) {
      if (cl.archived) continue
      let changed = false

      if (cl.trackMode === 'items') {
        walkNodes(cl.items, n => {
          if (n.type === 'item' && n.status === 'snoozed' && n.snoozeUntil && n.snoozeUntil <= today) {
            n.status = 'active'
            n.snoozeUntil = null
            n.snoozedAt = null
            changed = true
          }
        })
      } else if (cl.trackMode === 'checklist' && cl.status === 'snoozed' && cl.snoozeUntil && cl.snoozeUntil <= today) {
        cl.status = 'active'
        cl.snoozeUntil = null
        cl.snoozedAt = null
        changed = true
      }

      if (changed) void upsertChecklist(cl)
    }
  }

  function completeWeeklyReview(): void {
    planMeta.lastReviewedAt = new Date().toISOString()
    planMetaStore.persistPlanMeta()
  }

  // ── Suggest algorithm ───────────────────────────────────────────────────────

  function suggestDayPlan(): Array<ChecklistItemId> {
    const today = todayDateString()
    const now = Date.now()
    const t = parseLocalDate(today); t.setDate(t.getDate() + 1); const tomorrow = toLocalDateString(t)

    // Phase 1 — keep existing selections, charge their effort against the budget
    const kept: Array<ChecklistItemId> = []
    const keptKeys = new Set<string>()
    let budgetLeft = DAY_PLAN_EFFORT_BUDGET

    for (const r of activeTrackedItems.value) {
      if (!r.item.selectedForToday) continue
      const key = itemKey(r.checklistId, r.item.id)
      kept.push({ checklistId: r.checklistId, itemId: r.item.id })
      keptKeys.add(key)
      budgetLeft -= effortUnits(r)
    }

    // Phase 2 — partition unselected items: mandatory (deadline ≤ tomorrow)
    // are always added; optional are filtered by the dismissal map
    const mandatory: Array<ChecklistItemId> = []
    const optional: TrackedItemRef[] = []

    for (const r of activeTrackedItems.value) {
      const key = itemKey(r.checklistId, r.item.id)
      if (keptKeys.has(key)) continue

      const dl = r.item.deadline?.substring(0, 10)
      if (dl && dl <= tomorrow) {
        mandatory.push({ checklistId: r.checklistId, itemId: r.item.id })
        budgetLeft -= effortUnits(r)
      } else {
        const expiry = dismissedUntil[key]
        if (!expiry || now >= expiry) optional.push(r)
      }
    }

    // Phase 3 — fill remaining budget with highest-scored optional items.
    // Exception: one L task may be the sole pick when it outscores everything.
    const planIsEmpty = kept.length === 0 && mandatory.length === 0
    const additions: Array<ChecklistItemId> = []

    const sorted = optional
      .map(r => ({ ref: r, units: effortUnits(r), score: scoreItem(r, today) }))
      .sort((a, b) => b.score - a.score)

    for (const s of sorted) {
      if (budgetLeft <= 0) break
      const isTopLargeAlone = s.ref.item.effort === 'large' && planIsEmpty && additions.length === 0
      if (s.units <= budgetLeft || isTopLargeAlone) {
        additions.push({ checklistId: s.ref.checklistId, itemId: s.ref.item.id })
        budgetLeft -= s.units
      }
    }

    return [...kept, ...mandatory, ...additions]
  }

  function suggestWeekPlan(): TrackedItemRef[] {
    return trackedItems.value
      .filter(r => (r.item.status ?? 'active') === 'snoozed')
      .sort((a, b) => {
        const aDate = a.item.snoozeUntil ?? '9999-99-99'
        const bDate = b.item.snoozeUntil ?? '9999-99-99'
        if (aDate !== bDate) return aDate < bDate ? -1 : 1
        const aPri = PRIORITY_ORDER[a.item.priority ?? 'important'] ?? 1
        const bPri = PRIORITY_ORDER[b.item.priority ?? 'important'] ?? 1
        return aPri - bPri
      })
  }

  // ── Item task-tracking mutations ────────────────────────────────────────────

  function withChecklist(id: string, fn: (cl: Checklist) => void): void {
    const cl = getChecklist(id)
    if (!cl) return
    fn(cl)
    void upsertChecklist(cl)
  }

  function isChecklistTaskRef(ref: ChecklistItemId): boolean {
    const cl = getChecklist(ref.checklistId)
    return cl?.trackMode === 'checklist' && ref.itemId === ref.checklistId
  }

  function setItemPriority(ref: ChecklistItemId, priority: TaskPriority): void {
    if (isChecklistTaskRef(ref)) {
      withChecklist(ref.checklistId, cl => { cl.priority = priority })
    } else {
      withItem(ref, item => { item.priority = priority })
    }
  }

  function setItemEffort(ref: ChecklistItemId, effort: TaskEffort): void {
    if (isChecklistTaskRef(ref)) {
      withChecklist(ref.checklistId, cl => { cl.effort = effort })
    } else {
      withItem(ref, item => { item.effort = effort })
    }
  }

  function snoozeItem(ref: ChecklistItemId, until: string): void {
    if (isChecklistTaskRef(ref)) {
      withChecklist(ref.checklistId, cl => {
        cl.status = 'snoozed'
        cl.snoozeUntil = until
        if (!cl.snoozedAt) cl.snoozedAt = new Date().toISOString()
        cl.selectedForToday = false
      })
    } else {
      withItem(ref, item => {
        item.status = 'snoozed'
        item.snoozeUntil = until
        if (!item.snoozedAt) item.snoozedAt = new Date().toISOString()
        item.selectedForToday = false
      })
    }
  }

  function activateItem(ref: ChecklistItemId): void {
    if (isChecklistTaskRef(ref)) {
      withChecklist(ref.checklistId, cl => {
        cl.status = 'active'
        cl.snoozeUntil = null
        cl.snoozedAt = null
      })
    } else {
      withItem(ref, item => {
        item.status = 'active'
        item.snoozeUntil = null
        item.snoozedAt = null
      })
    }
  }

  function sendItemToSomeday(ref: ChecklistItemId): void {
    if (isChecklistTaskRef(ref)) {
      withChecklist(ref.checklistId, cl => {
        cl.status = 'someday'
        cl.snoozeUntil = null
        cl.snoozedAt = null
        cl.selectedForToday = false
      })
    } else {
      withItem(ref, item => {
        item.status = 'someday'
        item.snoozeUntil = null
        item.snoozedAt = null
        item.selectedForToday = false
      })
    }
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
    dismissedKeys,
    clearDayPlan,
    toggleItemDayPlan,
    setDayPlan,
    refreshDayPlanIfStale,
    processDueSnoozed,
    completeWeeklyReview,
    suggestDayPlan,
    suggestWeekPlan,
    setItemPriority,
    setItemEffort,
    snoozeItem,
    activateItem,
    sendItemToSomeday,
  }
}
