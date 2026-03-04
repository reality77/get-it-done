import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task, TaskMeta, TaskPriority, TaskEffort, TaskStatus } from '../types'

// ── Storage ───────────────────────────────────────────────────────────────────

const TASKS_STORAGE_KEY = 'make-it-done-tasks-v1'

interface TasksStorageShape {
  tasks: Task[]
  meta: TaskMeta
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function generateId(): string {
  return crypto.randomUUID()
}

function loadFromStorage(): TasksStorageShape {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY)
    if (!raw) return { tasks: [], meta: { lastReviewedAt: null, dayPlanDate: null } }
    const parsed = JSON.parse(raw) as Partial<TasksStorageShape>
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      meta: parsed.meta ?? { lastReviewedAt: null, dayPlanDate: null },
    }
  } catch {
    return { tasks: [], meta: { lastReviewedAt: null, dayPlanDate: null } }
  }
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

// ── Store ─────────────────────────────────────────────────────────────────────

export const useTaskStore = defineStore('tasks', () => {
  const stored = loadFromStorage()
  const tasks = ref<Task[]>(stored.tasks)
  const meta = ref<TaskMeta>(stored.meta)

  // ── Persistence ─────────────────────────────────────────────────────────────

  function persist(): void {
    const shape: TasksStorageShape = { tasks: tasks.value, meta: meta.value }
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(shape))
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  const activeTasks = computed(() =>
    tasks.value.filter(t => t.status === 'active')
  )

  const dayTasks = computed(() =>
    tasks.value.filter(t => t.selectedForToday && t.status === 'active')
  )

  const snoozedTasks = computed(() =>
    tasks.value.filter(t => t.status === 'snoozed')
  )

  const somedayTasks = computed(() =>
    tasks.value.filter(t => t.status === 'someday')
  )

  const dueSnoozedTasks = computed(() => {
    const today = todayDateString()
    return tasks.value.filter(
      t => t.status === 'snoozed' && t.snoozeUntil !== null && t.snoozeUntil <= today
    )
  })

  const staleSnoozedTasks = computed(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    return tasks.value.filter(t => {
      if (t.status !== 'snoozed' || !t.snoozedAt) return false
      return new Date(t.snoozedAt) < cutoff
    })
  })

  const weekTasksByPriority = computed(() => ({
    urgent:    activeTasks.value.filter(t => t.priority === 'urgent'),
    important: activeTasks.value.filter(t => t.priority === 'important'),
    secondary: activeTasks.value.filter(t => t.priority === 'secondary'),
  }))

  const weeklyReviewDue = computed((): boolean => {
    const today = new Date()
    const isMonday = today.getDay() === 1
    const hasDueSnoozed = dueSnoozedTasks.value.length > 0
    const lastReview = meta.value.lastReviewedAt
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const overdueReview = !lastReview || new Date(lastReview) < sevenDaysAgo
    return isMonday || hasDueSnoozed || overdueReview
  })

  const isDayPlanFresh = computed(() =>
    meta.value.dayPlanDate === todayDateString()
  )

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  function createTask(
    title: string,
    priority: TaskPriority = 'important',
    effort: TaskEffort = 'medium'
  ): Task {
    const now = new Date().toISOString()
    const task: Task = {
      id: generateId(),
      title,
      status: 'active',
      priority,
      effort,
      selectedForToday: false,
      snoozeUntil: null,
      snoozedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    tasks.value.push(task)
    persist()
    return task
  }

  function updateTask(
    id: string,
    patch: Partial<Pick<Task, 'title' | 'priority' | 'effort' | 'status' | 'snoozeUntil' | 'selectedForToday'>>
  ): void {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    Object.assign(task, patch, { updatedAt: new Date().toISOString() })
    persist()
  }

  function deleteTask(id: string): void {
    tasks.value = tasks.value.filter(t => t.id !== id)
    persist()
  }

  // ── Status transitions ────────────────────────────────────────────────────────

  function activateTask(id: string): void {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    task.status = 'active'
    task.snoozeUntil = null
    task.snoozedAt = null
    task.updatedAt = new Date().toISOString()
    persist()
  }

  function snoozeTask(id: string, until: string): void {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    task.status = 'snoozed'
    task.snoozeUntil = until
    if (!task.snoozedAt) task.snoozedAt = new Date().toISOString()
    task.selectedForToday = false
    task.updatedAt = new Date().toISOString()
    persist()
  }

  function sendToSomeday(id: string): void {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    task.status = 'someday'
    task.snoozeUntil = null
    task.snoozedAt = null
    task.selectedForToday = false
    task.updatedAt = new Date().toISOString()
    persist()
  }

  function processDueSnoozed(): void {
    const today = todayDateString()
    for (const task of tasks.value) {
      if (task.status === 'snoozed' && task.snoozeUntil && task.snoozeUntil <= today) {
        task.status = 'active'
        task.snoozeUntil = null
        task.snoozedAt = null
        task.updatedAt = new Date().toISOString()
      }
    }
    persist()
  }

  // ── Day planning ──────────────────────────────────────────────────────────────

  function setDayPlan(taskIds: string[]): void {
    const idSet = new Set(taskIds)
    for (const task of tasks.value) {
      task.selectedForToday = idSet.has(task.id)
    }
    meta.value.dayPlanDate = todayDateString()
    persist()
  }

  function toggleDayPlanTask(id: string): void {
    const task = tasks.value.find(t => t.id === id)
    if (!task || task.status !== 'active') return
    task.selectedForToday = !task.selectedForToday
    if (!meta.value.dayPlanDate) meta.value.dayPlanDate = todayDateString()
    persist()
  }

  function refreshDayPlanIfStale(): void {
    if (meta.value.dayPlanDate && meta.value.dayPlanDate !== todayDateString()) {
      for (const task of tasks.value) {
        task.selectedForToday = false
      }
      meta.value.dayPlanDate = null
      persist()
    }
  }

  // ── Weekly review ─────────────────────────────────────────────────────────────

  function completeWeeklyReview(): void {
    meta.value.lastReviewedAt = new Date().toISOString()
    persist()
  }

  // ── Suggestion algorithm ──────────────────────────────────────────────────────

  function suggestDayPlan(): Task[] {
    const priorityScore: Record<TaskPriority, number> = { urgent: 30, important: 20, secondary: 10 }
    const effortScore: Record<TaskEffort, number> = { small: 3, medium: 2, large: 1 }

    type ScoredTask = { task: Task; score: number; jitter: number }
    const scored: ScoredTask[] = activeTasks.value.map(t => ({
      task: t,
      score: priorityScore[t.priority] + effortScore[t.effort],
      jitter: Math.random(),
    }))

    scored.sort((a, b) => b.score - a.score || b.jitter - a.jitter)

    // Balance pass: alternate effort levels where possible
    const result: Task[] = []
    const remaining = scored.map(s => s.task)
    let lastEffort: TaskEffort | null = null

    while (result.length < 5 && remaining.length > 0) {
      let idx = remaining.findIndex(t => t.effort !== lastEffort)
      if (idx === -1) idx = 0
      const picked = remaining.splice(idx, 1)[0]
      if (!picked) break
      lastEffort = picked.effort
      result.push(picked)
    }

    return result
  }

  return {
    // state (exposed as refs for storeToRefs)
    tasks,
    meta,
    // computed
    activeTasks,
    dayTasks,
    snoozedTasks,
    somedayTasks,
    dueSnoozedTasks,
    staleSnoozedTasks,
    weekTasksByPriority,
    weeklyReviewDue,
    isDayPlanFresh,
    // methods
    createTask,
    updateTask,
    deleteTask,
    activateTask,
    snoozeTask,
    sendToSomeday,
    processDueSnoozed,
    setDayPlan,
    toggleDayPlanTask,
    refreshDayPlanIfStale,
    completeWeeklyReview,
    suggestDayPlan,
  }
})

// Re-export status type for components that need to work with task status
export type { TaskStatus }
