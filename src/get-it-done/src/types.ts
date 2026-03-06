export type ChecklistKind = 'one-time' | 'template' | 'run'

// ── Task fields (used by tracked checklist items) ─────────────────────────────

export type TaskStatus   = 'active' | 'snoozed' | 'someday'
export type TaskPriority = 'urgent' | 'important' | 'secondary'
export type TaskEffort   = 'small' | 'medium' | 'large'
export type TaskView     = 'day' | 'week' | 'backlog'

// ── Planning metadata (persisted globally) ────────────────────────────────────

export interface PlanMeta {
  lastReviewedAt: string | null  // ISO timestamp of last weekly review
  dayPlanDate: string | null     // YYYY-MM-DD — which day the current plan is for
}

// ── Checklist types ───────────────────────────────────────────────────────────

export interface ChecklistItem {
  type: 'item'
  id: string
  text: string
  done: boolean
  // Task fields — only populated when parent checklist is tracked
  priority?: TaskPriority
  effort?: TaskEffort
  status?: TaskStatus            // defaults to 'active'
  selectedForToday?: boolean
  snoozeUntil?: string | null    // YYYY-MM-DD
  snoozedAt?: string | null      // ISO timestamp, for 14-day alert
  completedAt?: string | null    // ISO timestamp of completion
}

export interface ChecklistItemGroup {
  type: 'group'
  id: string
  title: string
  collapsed: boolean
  children: ChecklistNode[]
}

export type ChecklistNode = ChecklistItem | ChecklistItemGroup

export interface Checklist {
  id: string
  kind: ChecklistKind
  title: string
  items: ChecklistNode[]
  archived: boolean
  createdAt: string
  archivedAt: string | null
  templateId: string | null
  runLabel: string | null
  // Task-tracking fields
  tracked: boolean
  defaultPriority: TaskPriority
  defaultEffort: TaskEffort
}

/** Flattened reference to a tracked checklist item (used in Tasks views) */
export interface TrackedItemRef {
  item: ChecklistItem
  checklistId: string
  checklistTitle: string
}

export interface ChecklistItemId {
  checklistId: string
  itemId: string
}

// ── TaskCard generic action types ─────────────────────────────────────────────

export interface SwipeActionDef {
  hint: string
  bgClass: string
  onTrigger: () => void
}

export interface ButtonActionDef {
  label: string
  title?: string
  variant?: 'icon' | 'danger'
  /** Normal button action */
  onClick?: () => void
  /** Snooze button — renders a SnoozeMenu dropdown; calls snooze(date) on pick */
  snooze?: (date: string) => void
}