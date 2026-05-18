import { createHash } from 'node:crypto'

const COUCH_URL  = process.env.COUCH_URL      ?? 'http://localhost:5984'
const COUCH_USER = process.env.COUCH_USER     ?? 'admin'
const COUCH_PASS = process.env.COUCH_PASSWORD ?? ''

const SUBS_DB   = 'push_subscriptions'
const DATA_DB   = 'get-it-done'
const FIRED_DB  = 'push_fired_reminders'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface SubscriptionDoc {
  _id: string
  _rev?: string
  userId: string
  subscription: PushSubscription
  dailyReminderTime: string | null
  createdAt: string
  updatedAt: string
}

type ChecklistNode = ChecklistItem | ChecklistGroup

interface ChecklistItem {
  type: 'item'
  id: string
  text: string
  status?: 'active' | 'snoozed' | 'someday'
  snoozeUntil?: string | null
  reminders?: string[]
}

interface ChecklistGroup {
  type: 'group'
  children: ChecklistNode[]
}

interface ChecklistDoc {
  _id: string
  items?: ChecklistNode[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const adminAuth = `Basic ${Buffer.from(`${COUCH_USER}:${COUCH_PASS}`).toString('base64')}`

async function couchFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${COUCH_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: adminAuth,
      ...(init.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) throw new Error(`CouchDB ${res.status} at ${path}: ${await res.text()}`)
  return res.json() as Promise<T>
}

function subId(userId: string, endpoint: string): string {
  const hash = createHash('sha256').update(endpoint).digest('hex').slice(0, 16)
  return `${userId}_${hash}`
}

function flattenItems(nodes: ChecklistNode[]): ChecklistItem[] {
  return nodes.flatMap(n => (n.type === 'item' ? [n] : flattenItems(n.children)))
}

// ── Session validation ────────────────────────────────────────────────────────

export async function validateSession(cookie: string): Promise<string | null> {
  try {
    const res = await fetch(`${COUCH_URL}/_session`, { headers: { Cookie: cookie } })
    if (!res.ok) return null
    const data = await res.json() as { userCtx?: { name: string | null } }
    return data.userCtx?.name ?? null
  } catch {
    return null
  }
}

// ── push_subscriptions DB setup ───────────────────────────────────────────────

export async function ensureSubsDb(): Promise<void> {
  try {
    await couchFetch(`/${SUBS_DB}`, { method: 'PUT' })
  } catch (e) {
    // 412 = already exists — fine; anything else re-thrown
    if (!(e instanceof Error && e.message.includes('412'))) throw e
  }
}

// ── Subscription CRUD ─────────────────────────────────────────────────────────

export async function saveSubscription(
  userId: string,
  subscription: PushSubscription,
  dailyReminderTime: string | null,
): Promise<void> {
  const _id = subId(userId, subscription.endpoint)
  const existing = await couchFetch<SubscriptionDoc>(`/${SUBS_DB}/${_id}`).catch(() => null)
  const doc: SubscriptionDoc = {
    _id,
    ...(existing?._rev ? { _rev: existing._rev } : {}),
    userId,
    subscription,
    dailyReminderTime,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await couchFetch(`/${SUBS_DB}/${_id}`, { method: 'PUT', body: JSON.stringify(doc) })
}

export async function deleteSubscription(userId: string, endpoint: string): Promise<void> {
  const _id = subId(userId, endpoint)
  const existing = await couchFetch<SubscriptionDoc>(`/${SUBS_DB}/${_id}`).catch(() => null)
  if (!existing?._rev) return
  await couchFetch(`/${SUBS_DB}/${_id}?rev=${existing._rev}`, { method: 'DELETE' })
}

export async function getAllSubscriptions(): Promise<SubscriptionDoc[]> {
  const result = await couchFetch<{ rows: Array<{ doc: SubscriptionDoc }> }>(
    `/${SUBS_DB}/_all_docs?include_docs=true`,
  )
  return result.rows.map(r => r.doc).filter(Boolean)
}

// ── Snooze scanner ────────────────────────────────────────────────────────────

export async function findDueSnoozedItems(today: string): Promise<{ text: string }[]> {
  const result = await couchFetch<{ rows: Array<{ doc: ChecklistDoc | null }> }>(
    `/${DATA_DB}/_all_docs?include_docs=true`,
  )
  const due: { text: string }[] = []
  for (const { doc } of result.rows) {
    if (!doc?.items) continue
    for (const item of flattenItems(doc.items)) {
      if (item.status === 'snoozed' && item.snoozeUntil && item.snoozeUntil <= today) {
        due.push({ text: item.text })
      }
    }
  }
  return due
}

// ── Task reminder scanner ─────────────────────────────────────────────────────

export interface DueReminder {
  checklistId: string
  itemId: string
  text: string
  reminderAt: string
}

export async function findDueTaskReminders(
  windowStart: Date,
  windowEnd: Date,
): Promise<DueReminder[]> {
  const result = await couchFetch<{ rows: Array<{ id: string; doc: ChecklistDoc | null }> }>(
    `/${DATA_DB}/_all_docs?include_docs=true`,
  )
  const due: DueReminder[] = []
  for (const { id: checklistId, doc } of result.rows) {
    if (!doc?.items) continue
    for (const item of flattenItems(doc.items)) {
      if (!item.reminders?.length) continue
      for (const reminderAt of item.reminders) {
        const t = new Date(reminderAt)
        if (t >= windowStart && t < windowEnd) {
          due.push({ checklistId, itemId: item.id, text: item.text, reminderAt })
        }
      }
    }
  }
  return due
}

// ── Fired-reminders DB ────────────────────────────────────────────────────────

export async function ensureFiredRemindersDb(): Promise<void> {
  try {
    await couchFetch(`/${FIRED_DB}`, { method: 'PUT' })
  } catch (e) {
    if (!(e instanceof Error && e.message.includes('412'))) throw e
  }
}

function firedId(checklistId: string, itemId: string, reminderAt: string): string {
  return createHash('sha256')
    .update(`${checklistId}:${itemId}:${reminderAt}`)
    .digest('hex')
    .slice(0, 32)
}

export async function isReminderFired(
  checklistId: string,
  itemId: string,
  reminderAt: string,
): Promise<boolean> {
  const id = firedId(checklistId, itemId, reminderAt)
  const result = await couchFetch<{ _id: string }>(`/${FIRED_DB}/${id}`).catch(() => null)
  return result !== null
}

export async function markReminderFired(
  checklistId: string,
  itemId: string,
  reminderAt: string,
): Promise<void> {
  const id = firedId(checklistId, itemId, reminderAt)
  await couchFetch(`/${FIRED_DB}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ _id: id, checklistId, itemId, reminderAt, firedAt: new Date().toISOString() }),
  })
}
