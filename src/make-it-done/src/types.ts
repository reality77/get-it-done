export type ChecklistKind = 'one-time' | 'template' | 'run'

// ── Task Manager ──────────────────────────────────────────────────────────────

export type TaskStatus   = 'active' | 'snoozed' | 'someday'
export type TaskPriority = 'urgent' | 'important' | 'secondary'
export type TaskEffort   = 'small' | 'medium' | 'large'
export type TaskView     = 'day' | 'week'

export interface Task {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  effort: TaskEffort
  selectedForToday: boolean
  snoozeUntil: string | null     // YYYY-MM-DD
  snoozedAt: string | null       // ISO timestamp, for 14-day alert
  createdAt: string
  updatedAt: string
}

export interface TaskMeta {
  lastReviewedAt: string | null  // ISO timestamp of last weekly review
  dayPlanDate: string | null     // YYYY-MM-DD — which day the current plan is for
}

export interface ChecklistItem {
  type: 'item'
  id: string
  text: string
  done: boolean
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
}
