import { ref, computed, watch } from 'vue'
import type { Checklist, ChecklistItem, ChecklistItemGroup, ChecklistNode, ChecklistKind } from '../types'

const STORAGE_KEY = 'make-it-done-v1'

const checklists = ref<Checklist[]>([])

// ── Private tree helpers ──────────────────────────────────────────────────────

function walkNodes(nodes: ChecklistNode[], visitor: (n: ChecklistNode) => void): void {
  for (const node of nodes) {
    visitor(node)
    if (node.type === 'group') walkNodes(node.children, visitor)
  }
}

function findItemDeep(nodes: ChecklistNode[], itemId: string): ChecklistItem | undefined {
  for (const node of nodes) {
    if (node.type === 'item' && node.id === itemId) return node
    if (node.type === 'group') {
      const found = findItemDeep(node.children, itemId)
      if (found) return found
    }
  }
  return undefined
}

function findGroupDeep(nodes: ChecklistNode[], groupId: string): ChecklistItemGroup | undefined {
  for (const node of nodes) {
    if (node.type === 'group' && node.id === groupId) return node
    if (node.type === 'group') {
      const found = findGroupDeep(node.children, groupId)
      if (found) return found
    }
  }
  return undefined
}

function removeNodeDeep(nodes: ChecklistNode[], targetId: string): ChecklistNode[] {
  return nodes
    .filter(n => n.id !== targetId)
    .map(n =>
      n.type === 'group'
        ? { ...n, children: removeNodeDeep(n.children, targetId) }
        : n
    )
}

function cloneNodes(nodes: ChecklistNode[]): ChecklistNode[] {
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

// ── Data migration ────────────────────────────────────────────────────────────

function migrateNodes(raw: unknown[]): ChecklistNode[] {
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
    return {
      type: 'item',
      id: String(node.id ?? crypto.randomUUID()),
      text: String(node.text ?? ''),
      done: Boolean(node.done ?? false),
    }
  })
}

function hydrate(): void {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as { checklists: unknown[] }
    checklists.value = (parsed.checklists ?? []).map((c): Checklist => {
      const cl = c as Record<string, unknown>
      return {
        id: String(cl.id),
        kind: cl.kind as ChecklistKind,
        title: String(cl.title ?? ''),
        items: migrateNodes((cl.items as unknown[]) ?? []),
        archived: Boolean(cl.archived ?? false),
        createdAt: String(cl.createdAt ?? new Date().toISOString()),
        archivedAt: cl.archivedAt ? String(cl.archivedAt) : null,
        templateId: cl.templateId ? String(cl.templateId) : null,
        runLabel: cl.runLabel ? String(cl.runLabel) : null,
      }
    })
  } catch {
    // silent fail — corrupt data, start fresh
  }
}

function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ checklists: checklists.value }))
}

hydrate()
watch(checklists, persist, { deep: true })

// ── Private helpers ───────────────────────────────────────────────────────────

function findChecklist(id: string): Checklist | undefined {
  return checklists.value.find(c => c.id === id)
}

// ── Computed views ────────────────────────────────────────────────────────────

const activeChecklists = computed(() =>
  checklists.value
    .filter(c => c.kind !== 'template' && !c.archived)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
)

const templates = computed(() =>
  checklists.value.filter(c => c.kind === 'template')
)

const archivedChecklists = computed(() =>
  checklists.value
    .filter(c => c.archived)
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
)

// ── Checklist CRUD ────────────────────────────────────────────────────────────

function createChecklist(
  kind: ChecklistKind,
  title: string,
  items: Omit<ChecklistItem, 'id'>[],
): Checklist {
  const checklist: Checklist = {
    id: crypto.randomUUID(),
    kind,
    title,
    items: items.map(i => ({ ...i, id: crypto.randomUUID() })),
    archived: false,
    createdAt: new Date().toISOString(),
    archivedAt: null,
    templateId: null,
    runLabel: null,
  }
  checklists.value.push(checklist)
  return checklist
}

function updateChecklist(
  id: string,
  patch: { title?: string; items?: ChecklistNode[] },
): void {
  const checklist = findChecklist(id)
  if (!checklist) return
  if (patch.title !== undefined) checklist.title = patch.title
  if (patch.items !== undefined) checklist.items = patch.items
}

function deleteChecklist(id: string): void {
  const target = findChecklist(id)
  if (!target) return
  if (target.kind === 'template') {
    checklists.value = checklists.value.filter(c => c.id !== id && c.templateId !== id)
  } else {
    checklists.value = checklists.value.filter(c => c.id !== id)
  }
}

function archiveChecklist(id: string): void {
  const checklist = findChecklist(id)
  if (!checklist) return
  checklist.archived = true
  checklist.archivedAt = new Date().toISOString()
}

function unarchiveChecklist(id: string): void {
  const checklist = findChecklist(id)
  if (!checklist) return
  checklist.archived = false
  checklist.archivedAt = null
}

function runTemplate(templateId: string): Checklist {
  const template = findChecklist(templateId)
  if (!template) throw new Error(`Template ${templateId} not found`)
  let runCount = 0
  for (const c of checklists.value) if (c.templateId === templateId) runCount++
  const run: Checklist = {
    id: crypto.randomUUID(),
    kind: 'run',
    title: template.title,
    items: cloneNodes(template.items),
    archived: false,
    createdAt: new Date().toISOString(),
    archivedAt: null,
    templateId,
    runLabel: `${template.title} — Run #${runCount + 1}`,
  }
  checklists.value.push(run)
  return run
}

// ── Item CRUD (tree-aware) ────────────────────────────────────────────────────

function toggleItem(checklistId: string, itemId: string): void {
  const checklist = findChecklist(checklistId)
  if (!checklist) return
  const item = findItemDeep(checklist.items, itemId)
  if (!item) return
  item.done = !item.done
}

function addItem(checklistId: string, text: string, parentGroupId?: string): ChecklistItem {
  const checklist = findChecklist(checklistId)
  if (!checklist) throw new Error(`Checklist ${checklistId} not found`)
  const item: ChecklistItem = { type: 'item', id: crypto.randomUUID(), text, done: false }
  if (parentGroupId) {
    const group = findGroupDeep(checklist.items, parentGroupId)
    if (!group) throw new Error(`Group ${parentGroupId} not found`)
    group.children.push(item)
  } else {
    checklist.items.push(item)
  }
  return item
}

function updateItemText(checklistId: string, itemId: string, text: string): void {
  const checklist = findChecklist(checklistId)
  if (!checklist) return
  const item = findItemDeep(checklist.items, itemId)
  if (!item) return
  item.text = text
}

function removeItem(checklistId: string, itemId: string): void {
  const checklist = findChecklist(checklistId)
  if (!checklist) return
  checklist.items = removeNodeDeep(checklist.items, itemId)
}

// ── Group CRUD ────────────────────────────────────────────────────────────────

function addGroup(checklistId: string, title: string, parentGroupId?: string): ChecklistItemGroup {
  const checklist = findChecklist(checklistId)
  if (!checklist) throw new Error(`Checklist ${checklistId} not found`)
  const group: ChecklistItemGroup = {
    type: 'group',
    id: crypto.randomUUID(),
    title,
    collapsed: false,
    children: [],
  }
  if (parentGroupId) {
    const parent = findGroupDeep(checklist.items, parentGroupId)
    if (!parent) throw new Error(`Parent group ${parentGroupId} not found`)
    parent.children.push(group)
  } else {
    checklist.items.push(group)
  }
  return group
}

function updateGroupTitle(checklistId: string, groupId: string, title: string): void {
  const checklist = findChecklist(checklistId)
  if (!checklist) return
  const group = findGroupDeep(checklist.items, groupId)
  if (!group) return
  group.title = title
}

function toggleGroupCollapsed(checklistId: string, groupId: string): void {
  const checklist = findChecklist(checklistId)
  if (!checklist) return
  const group = findGroupDeep(checklist.items, groupId)
  if (!group) return
  group.collapsed = !group.collapsed
}

function removeGroup(checklistId: string, groupId: string): void {
  const checklist = findChecklist(checklistId)
  if (!checklist) return
  checklist.items = removeNodeDeep(checklist.items, groupId)
}

export function useChecklists() {
  return {
    activeChecklists,
    templates,
    archivedChecklists,
    getChecklist: findChecklist,
    createChecklist,
    updateChecklist,
    deleteChecklist,
    toggleItem,
    archiveChecklist,
    unarchiveChecklist,
    runTemplate,
    addItem,
    updateItemText,
    removeItem,
    addGroup,
    updateGroupTitle,
    toggleGroupCollapsed,
    removeGroup,
    countItems,
    countDone,
  }
}
