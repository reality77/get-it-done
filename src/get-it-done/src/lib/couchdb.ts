import PouchDB from 'pouchdb-browser'
import type { Checklist, ChecklistItem, ChecklistNode, TrackMode } from '../types'

export const COUCH_URL = (import.meta.env.VITE_COUCH_URL as string | undefined) ?? 'http://localhost:5984'
export const DB_NAME = 'get-it-done'

// ── Document type ─────────────────────────────────────────────────────────────

// CouchDB document: same shape as Checklist but uses _id instead of id
export type CouchDoc = Omit<Checklist, 'id'>

export function checklistToDoc(c: Checklist): PouchDB.Core.Document<CouchDoc> {
  const { id, ...rest } = c
  return { _id: id, ...rest }
}

export function docToChecklist(doc: PouchDB.Core.ExistingDocument<CouchDoc>): Checklist {
  const raw = doc as unknown as Record<string, unknown>
  const trackMode = (raw['trackMode'] as TrackMode | undefined)
    ?? (raw['tracked'] === true ? 'items' : 'none')
  return {
    id: doc._id, kind: doc.kind, title: doc.title, items: doc.items,
    archived: doc.archived, createdAt: doc.createdAt, archivedAt: doc.archivedAt,
    templateId: doc.templateId, runLabel: doc.runLabel,
    trackMode,
    defaultPriority: doc.defaultPriority, defaultEffort: doc.defaultEffort,
    priority: doc.priority, effort: doc.effort, status: doc.status,
    selectedForToday: doc.selectedForToday, selectedForWeek: doc.selectedForWeek,
    snoozeUntil: doc.snoozeUntil, snoozedAt: doc.snoozedAt,
    deadline: doc.deadline, reminders: doc.reminders,
    comment: doc.comment, url: doc.url,
    modifiedAt: doc.modifiedAt,
  }
}

// ── Conflict merge (pure) ─────────────────────────────────────────────────────

// Local tree traversal — lib/couchdb.ts must NOT import from composables/
// (cycle risk), so we re-implement the walkNodes-style descent here.
function collectItemIds(nodes: ChecklistNode[], out: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'item') out.add(node.id)
    else collectItemIds(node.children, out)
  }
}

function collectItems(nodes: ChecklistNode[], out: ChecklistItem[]): void {
  for (const node of nodes) {
    if (node.type === 'item') out.push(node)
    else collectItems(node.children, out)
  }
}

// Pure document-level merge for sync conflict resolution.
//
// The winner is chosen by the caller (newest modifiedAt). All top-level fields
// come from the winner — field-level changes are last-write-wins. The items
// array is merged so a task can never vanish: every item id present anywhere in
// the winner's tree keeps the WINNER's version; any item that exists ONLY in the
// loser is appended (flattened) to the end of the winner's top-level items array.
// Group structure of the winner is preserved untouched.
//
// Pure: depends only on its arguments, performs no I/O and no store access.
export function mergeChecklistDocs<T extends Pick<Checklist, 'items'>>(winner: T, loser: T): T {
  const winnerIds = new Set<string>()
  collectItemIds(winner.items, winnerIds)

  const loserItems: ChecklistItem[] = []
  collectItems(loser.items, loserItems)

  const orphans: ChecklistItem[] = []
  const seen = new Set<string>()
  for (const item of loserItems) {
    if (winnerIds.has(item.id) || seen.has(item.id)) continue
    seen.add(item.id)
    orphans.push(item)
  }

  if (orphans.length === 0) return winner
  return { ...winner, items: [...winner.items, ...orphans] }
}

// ── Local PouchDB (IndexedDB) ─────────────────────────────────────────────────

export const localDB = new PouchDB<CouchDoc>(DB_NAME)

// ── Remote DB factory (uses session cookie) ───────────────────────────────────

export function createRemoteDB(onNetworkError?: () => void): PouchDB.Database<CouchDoc> {
  function credentialedFetch(url: RequestInfo | URL, opts: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...opts, credentials: 'include' }).catch((err: unknown) => {
      onNetworkError?.()
      throw err
    })
  }
  return new PouchDB<CouchDoc>(`${COUCH_URL}/${DB_NAME}`, { fetch: credentialedFetch })
}

// ── CouchDB session helpers (raw fetch to /_session) ─────────────────────────

export async function couchLogin(username: string, password: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${COUCH_URL}/_session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: username, password }),
      credentials: 'include',
    })
  } catch {
    throw new Error('network')
  }
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error('server')
}

export function couchLogout(): void {
  void fetch(`${COUCH_URL}/_session`, { method: 'DELETE', credentials: 'include' })
}

export type SessionStatus =
  | { status: 'authenticated'; name: string }
  | { status: 'expired' }
  | { status: 'offline' }

export async function couchGetSession(): Promise<SessionStatus> {
  try {
    const res = await fetch(`${COUCH_URL}/_session`, { credentials: 'include' })
    if (res.status === 401 || res.status === 403) return { status: 'expired' }
    if (!res.ok) return { status: 'offline' }
    const data = await res.json() as { userCtx?: { name: string | null } }
    const name = data.userCtx?.name
    return name ? { status: 'authenticated', name } : { status: 'expired' }
  } catch {
    return { status: 'offline' }
  }
}

export async function ensureDatabase(): Promise<void> {
  // Creates the DB if it doesn't exist. CouchDB returns 201 (created) or 412 (exists) — both fine.
  const res = await fetch(`${COUCH_URL}/${DB_NAME}`, { method: 'PUT', credentials: 'include' })
  if (res.status === 401 || res.status === 403) throw new Error('unauthorized')
  if (!res.ok && res.status !== 412) throw new Error('server')
}
