import type { TaskPriority, TaskEffort } from '../types'

export const SYNC_INITIAL_RETRY_MS = 5_000
export const SYNC_MAX_RETRY_MS = 60_000

export const STALE_SNOOZE_DAYS = 14
export const WEEKLY_REVIEW_INTERVAL_DAYS = 7

export const HTTP_UNAUTHORIZED_STATUSES = [401, 403]

export const DAY_PLAN_PRIORITY_SCORES: Record<TaskPriority, number> = {
  urgent: 30,
  important: 20,
  secondary: 10,
}

// Effort in S-units: 3S = 1M, 3M = 1L → S=1, M=3, L=9
export const DAY_PLAN_EFFORT_UNITS: Record<TaskEffort, number> = {
  small:  1,
  medium: 3,
  large:  9,
}

// Total daily effort budget in S-units (9S = 3M = 1L)
export const DAY_PLAN_EFFORT_BUDGET = 9

// Deadline proximity bonuses per effort level.
// Larger tasks get bigger bonuses further out — an L task due next week
// is more disruptive to skip than an S task due next week.
export const DAY_PLAN_DEADLINE_BONUSES: Record<TaskEffort, {
  overdue: number; today: number; tomorrow: number
  week: number; twoWeeks: number; month: number; twoMonths: number
}> = {
  small:  { overdue: 100, today: 50, tomorrow: 35, week: 10, twoWeeks:  3, month: 0, twoMonths: 0 },
  medium: { overdue: 100, today: 60, tomorrow: 50, week: 20, twoWeeks: 10, month: 0, twoMonths: 0 },
  large:  { overdue: 100, today: 70, tomorrow: 50, week: 35, twoWeeks: 20, month: 5, twoMonths: 2 },
}
