import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Checklist,
  ChecklistItem,
  ChecklistItemGroup,
  ChecklistNode,
  ChecklistKind,
} from '../types'
import { pb } from '../lib/pocketbase'
import { useAuthStore } from './auth'

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'make-it-done-v1'
const PENDING_KEY = 'make-it-done-pending'

// ── Tree helpers ──────────────────────────────────────────────────────────────

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

// ── Data migration (handles old ChecklistItem[] without type field) ────────────

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

// ── Storage load / persist ────────────────────────────────────────────────────

function loadFromStorage(): Checklist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { checklists?: unknown[] }
    return (parsed.checklists ?? []).map((c): Checklist => {
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
    return []
  }
}

function loadPendingFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

// ── PocketBase record shape ───────────────────────────────────────────────────

interface PbRecord {
  id: string
  app_id: string
  kind: ChecklistKind
  title: string
  items: unknown[]
  archived: boolean
  created_at: string
  archived_at: string
  template_id: string
  run_label: string
}

function pbToChecklist(r: PbRecord): Checklist {
  return {
    id: r.app_id,
    kind: r.kind,
    title: r.title,
    items: migrateNodes(Array.isArray(r.items) ? r.items : []),
    archived: r.archived,
    createdAt: r.created_at,
    archivedAt: r.archived_at || null,
    templateId: r.template_id || null,
    runLabel: r.run_label || null,
  }
}

function checklistToPb(c: Checklist): Omit<PbRecord, 'id'> {
  return {
    app_id: c.id,
    kind: c.kind,
    title: c.title,
    items: c.items,
    archived: c.archived,
    created_at: c.createdAt,
    archived_at: c.archivedAt ?? '',
    template_id: c.templateId ?? '',
    run_label: c.runLabel ?? '',
  }
}

// ── Retry delays: 1s, 5s, 10s, then 60s repeating ───────────────────────────

const RETRY_DELAYS = [1_000, 5_000, 10_000, 60_000]

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Sync status type ──────────────────────────────────────────────────────────

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending'

// ── Store ─────────────────────────────────────────────────────────────────────

export const useChecklistStore = defineStore('checklists', () => {
  const checklists = ref<Checklist[]>(loadFromStorage())
  const syncStatus = ref<SyncStatus>('offline')
  const pendingSync = ref<Set<string>>(loadPendingFromStorage())

  let unsubscribe: (() => void) | null = null
  let retrying = false

  // ── Persistence ─────────────────────────────────────────────────────────────

  function persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ checklists: checklists.value }))
  }

  function persistPending(): void {
    localStorage.setItem(PENDING_KEY, JSON.stringify([...pendingSync.value]))
  }

  function markPending(appId: string): void {
    pendingSync.value.add(appId)
    persistPending()
    if (syncStatus.value === 'synced') syncStatus.value = 'pending'
  }

  function clearPending(): void {
    pendingSync.value.clear()
    persistPending()
  }

  // ── Computed views ───────────────────────────────────────────────────────────

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

  function getChecklist(id: string): Checklist | undefined {
    return checklists.value.find(c => c.id === id)
  }

  // ── PocketBase sync helpers ──────────────────────────────────────────────────

  async function getPbRecordId(appId: string): Promise<string | null> {
    try {
      const result = await pb.collection('checklists').getFirstListItem<PbRecord>(
        `app_id="${appId}"`
      )
      return result.id
    } catch {
      return null
    }
  }

  async function syncCreate(checklist: Checklist): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return
    try {
      await pb.collection('checklists').create(checklistToPb(checklist))
    } catch (e) {
      console.warn('[sync] create failed for', checklist.id, e)
      markPending(checklist.id)
    }
  }

  async function syncUpdate(checklist: Checklist): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return
    try {
      const pbId = await getPbRecordId(checklist.id)
      if (pbId) {
        await pb.collection('checklists').update(pbId, checklistToPb(checklist))
      } else {
        await pb.collection('checklists').create(checklistToPb(checklist))
      }
    } catch (e) {
      console.warn('[sync] update failed for', checklist.id, e)
      markPending(checklist.id)
    }
  }

  async function syncDelete(appId: string): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return
    try {
      const pbId = await getPbRecordId(appId)
      if (pbId) {
        await pb.collection('checklists').delete(pbId)
      }
    } catch (e) {
      console.warn('[sync] delete failed for', appId, e)
    }
  }

  // ── Real-time subscription ───────────────────────────────────────────────────

  async function subscribeRealtime(): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || unsubscribe) return
    try {
      unsubscribe = await pb.collection('checklists').subscribe('*', (event) => {
        const changed = pbToChecklist(event.record as unknown as PbRecord)
        if (event.action === 'create' || event.action === 'update') {
          if (pendingSync.value.has(changed.id)) return
          const idx = checklists.value.findIndex(c => c.id === changed.id)
          if (idx >= 0) checklists.value[idx] = changed
          else checklists.value.push(changed)
          persist()
        } else if (event.action === 'delete') {
          checklists.value = checklists.value.filter(c => c.id !== changed.id)
          persist()
        }
      })
    } catch (e) {
      console.warn('[sync] realtime subscribe failed', e)
    }
  }

  function unsubscribeRealtime(): void {
    unsubscribe?.()
    unsubscribe = null
  }

  // ── Backend health check ─────────────────────────────────────────────────────

  async function checkBackendHealth(): Promise<boolean> {
    try {
      await pb.health.check()
      return true
    } catch {
      return false
    }
  }

  // ── Retry loop: 1s → 5s → 10s → 60s repeating ──────────────────────────────

  async function startRetryLoop(): Promise<void> {
    if (retrying) return
    retrying = true
    let attempt = 0
    while (true) {
      const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)] ?? 60_000
      await sleep(delay)
      const ok = await checkBackendHealth()
      if (ok) {
        await reconnect()
        retrying = false
        break
      }
      attempt++
    }
  }

  async function loadAndMerge(): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    syncStatus.value = 'syncing'
    try {
      const records = await pb.collection('checklists').getFullList<PbRecord>({ sort: 'created' })
      const remote = records.map(pbToChecklist)

      const localMap = new Map(checklists.value.map(c => [c.id, c]))
      const remoteMap = new Map(remote.map(c => [c.id, c]))

      for (const [id, remoteItem] of remoteMap) {
        if (!pendingSync.value.has(id)) {
          localMap.set(id, remoteItem)
        }
      }

      checklists.value = Array.from(localMap.values())
      persist()

      const remoteIds = new Set(remoteMap.keys())
      const uploads: Promise<void>[] = []
      for (const item of checklists.value) {
        if (!remoteIds.has(item.id) || pendingSync.value.has(item.id)) {
          uploads.push(syncUpdate(item))
        }
      }
      await Promise.all(uploads)

      clearPending()
      syncStatus.value = 'synced'
    } catch (e) {
      console.warn('[sync] loadAndMerge failed', e)
      syncStatus.value = 'offline'
      throw e
    }
  }

  async function reconnect(): Promise<void> {
    unsubscribeRealtime()
    try {
      await loadAndMerge()
      await subscribeRealtime()
      syncStatus.value = 'synced'
    } catch {
      syncStatus.value = 'offline'
    }
  }

  async function initSync(): Promise<void> {
    try {
      await loadAndMerge()
      await subscribeRealtime()
    } catch {
      syncStatus.value = 'offline'
      startRetryLoop()
    }
  }

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
    persist()
    syncCreate(checklist)
    return checklist
  }

  function updateChecklist(
    id: string,
    patch: { title?: string; items?: ChecklistNode[] },
  ): void {
    const checklist = getChecklist(id)
    if (!checklist) return
    if (patch.title !== undefined) checklist.title = patch.title
    if (patch.items !== undefined) checklist.items = patch.items
    persist()
    syncUpdate(checklist)
  }

  function deleteChecklist(id: string): void {
    const target = getChecklist(id)
    if (!target) return
    let deletedIds: string[]
    if (target.kind === 'template') {
      deletedIds = checklists.value
        .filter(c => c.id === id || c.templateId === id)
        .map(c => c.id)
      checklists.value = checklists.value.filter(
        c => c.id !== id && c.templateId !== id
      )
    } else {
      deletedIds = [id]
      checklists.value = checklists.value.filter(c => c.id !== id)
    }
    persist()
    deletedIds.forEach(appId => syncDelete(appId))
  }

  function archiveChecklist(id: string): void {
    const checklist = getChecklist(id)
    if (!checklist) return
    checklist.archived = true
    checklist.archivedAt = new Date().toISOString()
    persist()
    syncUpdate(checklist)
  }

  function unarchiveChecklist(id: string): void {
    const checklist = getChecklist(id)
    if (!checklist) return
    checklist.archived = false
    checklist.archivedAt = null
    persist()
    syncUpdate(checklist)
  }

  function runTemplate(templateId: string): Checklist {
    const template = getChecklist(templateId)
    if (!template) throw new Error(`Template ${templateId} not found`)
    const runCount = checklists.value.filter(c => c.templateId === templateId).length
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
    persist()
    syncCreate(run)
    return run
  }

  // ── Item CRUD (tree-aware) ────────────────────────────────────────────────────

  function toggleItem(checklistId: string, itemId: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    const item = findItemDeep(checklist.items, itemId)
    if (!item) return
    item.done = !item.done
    if (
      checklist.kind !== 'template' &&
      countItems(checklist.items) > 0 &&
      countDone(checklist.items) === countItems(checklist.items)
    ) {
      checklist.archived = true
      checklist.archivedAt = new Date().toISOString()
    }
    persist()
    syncUpdate(checklist)
  }

  function addItem(checklistId: string, text: string, parentGroupId?: string): ChecklistItem {
    const checklist = getChecklist(checklistId)
    if (!checklist) throw new Error(`Checklist ${checklistId} not found`)
    const item: ChecklistItem = { type: 'item', id: crypto.randomUUID(), text, done: false }
    if (parentGroupId) {
      const group = findGroupDeep(checklist.items, parentGroupId)
      if (!group) throw new Error(`Group ${parentGroupId} not found`)
      group.children.push(item)
    } else {
      checklist.items.push(item)
    }
    persist()
    syncUpdate(checklist)
    return item
  }

  function updateItemText(checklistId: string, itemId: string, text: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    const item = findItemDeep(checklist.items, itemId)
    if (!item) return
    item.text = text
    persist()
    syncUpdate(checklist)
  }

  function removeItem(checklistId: string, itemId: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    checklist.items = removeNodeDeep(checklist.items, itemId)
    persist()
    syncUpdate(checklist)
  }

  // ── Group CRUD ────────────────────────────────────────────────────────────────

  function addGroup(checklistId: string, title: string, parentGroupId?: string): ChecklistItemGroup {
    const checklist = getChecklist(checklistId)
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
    persist()
    syncUpdate(checklist)
    return group
  }

  function updateGroupTitle(checklistId: string, groupId: string, title: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    const group = findGroupDeep(checklist.items, groupId)
    if (!group) return
    group.title = title
    persist()
    syncUpdate(checklist)
  }

  function toggleGroupCollapsed(checklistId: string, groupId: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    const group = findGroupDeep(checklist.items, groupId)
    if (!group) return
    group.collapsed = !group.collapsed
    persist()
    syncUpdate(checklist)
  }

  function removeGroup(checklistId: string, groupId: string): void {
    const checklist = getChecklist(checklistId)
    if (!checklist) return
    checklist.items = removeNodeDeep(checklist.items, groupId)
    persist()
    syncUpdate(checklist)
  }

  return {
    checklists,
    syncStatus,
    activeChecklists,
    templates,
    archivedChecklists,
    getChecklist,
    createChecklist,
    updateChecklist,
    deleteChecklist,
    archiveChecklist,
    unarchiveChecklist,
    runTemplate,
    toggleItem,
    addItem,
    updateItemText,
    removeItem,
    addGroup,
    updateGroupTitle,
    toggleGroupCollapsed,
    removeGroup,
    initSync,
    unsubscribeRealtime,
  }
})
