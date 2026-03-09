import type { TaskPriority, TaskEffort } from '../types'

export const SYNC_INITIAL_RETRY_MS = 5_000
export const SYNC_MAX_RETRY_MS = 60_000

export const DAY_PLAN_MAX_ITEMS = 5

export const STALE_SNOOZE_DAYS = 14
export const WEEKLY_REVIEW_INTERVAL_DAYS = 7

export const HTTP_UNAUTHORIZED_STATUSES = [401, 403]

export const DAY_PLAN_PRIORITY_SCORES: Record<TaskPriority, number> = {
  urgent: 30,
  important: 20,
  secondary: 10,
}

export const DAY_PLAN_EFFORT_SCORES: Record<TaskEffort, number> = {
  small: 3,
  medium: 2,
  large: 1,
}
