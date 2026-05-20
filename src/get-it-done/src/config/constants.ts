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
