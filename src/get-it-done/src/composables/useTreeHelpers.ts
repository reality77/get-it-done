import type {
  ChecklistItem,
  ChecklistItemGroup,
  ChecklistNode,
  TaskPriority,
  TaskEffort,
} from '../types'

// ── Date helper ───────────────────────────────────────────────────────────────

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Tree traversal ────────────────────────────────────────────────────────────

export function walkNodes(nodes: ChecklistNode[], visitor: (n: ChecklistNode) => void): void {
  for (const node of nodes) {
    visitor(node)
    if (node.type === 'group') walkNodes(node.children, visitor)
  }
}

export function findItemDeep(nodes: ChecklistNode[], itemId: string): ChecklistItem | undefined {
  for (const node of nodes) {
    if (node.type === 'item' && node.id === itemId) return node
    if (node.type === 'group') {
      const found = findItemDeep(node.children, itemId)
      if (found) return found
    }
  }
  return undefined
}

export function findGroupDeep(nodes: ChecklistNode[], groupId: string): ChecklistItemGroup | undefined {
  for (const node of nodes) {
    if (node.type === 'group' && node.id === groupId) return node
    if (node.type === 'group') {
      const found = findGroupDeep(node.children, groupId)
      if (found) return found
    }
  }
  return undefined
}

export function removeNodeDeep(nodes: ChecklistNode[], targetId: string): ChecklistNode[] {
  return nodes
    .filter(n => n.id !== targetId)
    .map(n =>
      n.type === 'group'
        ? { ...n, children: removeNodeDeep(n.children, targetId) }
        : n
    )
}

export function cloneNodes(nodes: ChecklistNode[]): ChecklistNode[] {
  return nodes.map(n => {
    if (n.type === 'item') {
      return { type: 'item' as const, id: crypto.randomUUID(), text: n.text, done: false }
    }
    return {
      type: 'group' as const,
      id: crypto.randomUUID(),
      title: n.title,
      collapsed: false,
      children: cloneNodes(n.children),
    }
  })
}

// ── Counters ──────────────────────────────────────────────────────────────────

export function countItems(nodes: ChecklistNode[]): number {
  let count = 0
  walkNodes(nodes, n => { if (n.type === 'item') count++ })
  return count
}

export function countDone(nodes: ChecklistNode[]): number {
  let count = 0
  walkNodes(nodes, n => { if (n.type === 'item' && n.done) count++ })
  return count
}

// ── Data migration (handles old ChecklistItem[] without type field) ───────────

export function migrateNodes(raw: unknown[]): ChecklistNode[] {
  return raw.map((n): ChecklistNode => {
    const node = n as Record<string, unknown>
    if (node.type === 'group') {
      return {
        type: 'group',
        id: String(node.id ?? crypto.randomUUID()),
        title: String(node.title ?? ''),
        collapsed: Boolean(node.collapsed ?? false),
        children: migrateNodes((node.children as unknown[]) ?? []),
      }
    }
    const item: ChecklistItem = {
      type: 'item',
      id: String(node.id ?? crypto.randomUUID()),
      text: String(node.text ?? ''),
      done: Boolean(node.done ?? false),
    }
    if (node.priority) item.priority = node.priority as TaskPriority
    if (node.effort) item.effort = node.effort as TaskEffort
    if (node.status) item.status = node.status as 'active' | 'snoozed' | 'someday'
    if (node.selectedForToday) item.selectedForToday = Boolean(node.selectedForToday)
    if (node.snoozeUntil !== undefined) item.snoozeUntil = node.snoozeUntil as string | null
    if (node.snoozedAt !== undefined) item.snoozedAt = node.snoozedAt as string | null
    if (node.completedAt !== undefined) item.completedAt = node.completedAt as string | null
    return item
  })
}
