import PouchDB from 'pouchdb-browser'
import type { Checklist } from '../types'

export const COUCH_URL = (import.meta.env.VITE_COUCH_URL as string | undefined) ?? 'http://localhost:5984'
export const DB_NAME = 'make-it-done'

// ── Document type ─────────────────────────────────────────────────────────────

// CouchDB document: same shape as Checklist but uses _id instead of id
export type CouchDoc = Omit<Checklist, 'id'>

export function checklistToDoc(c: Checklist): PouchDB.Core.Document<CouchDoc> {
  const { id, ...rest } = c
  return { _id: id, ...rest }
}

export function docToChecklist(doc: PouchDB.Core.ExistingDocument<CouchDoc>): Checklist {
  return { id: doc._id, kind: doc.kind, title: doc.title, items: doc.items,
    archived: doc.archived, createdAt: doc.createdAt, archivedAt: doc.archivedAt,
    templateId: doc.templateId, runLabel: doc.runLabel, tracked: doc.tracked,
    defaultPriority: doc.defaultPriority, defaultEffort: doc.defaultEffort }
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

export async function couchGetSession(): Promise<string | null> {
  try {
    const res = await fetch(`${COUCH_URL}/_session`, { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json() as { userCtx?: { name: string | null } }
    return data.userCtx?.name ?? null
  } catch {
    return null
  }
}

export async function ensureDatabase(): Promise<void> {
  // Creates the DB if it doesn't exist. CouchDB returns 201 (created) or 412 (exists) — both fine.
  await fetch(`${COUCH_URL}/${DB_NAME}`, { method: 'PUT', credentials: 'include' })
}
