import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Checklist, PlanMeta } from '../types'
import { localDB, createRemoteDB, checklistToDoc, docToChecklist, mergeChecklistDocs } from '../lib/couchdb'
import type { CouchDoc } from '../lib/couchdb'
import { useAuthStore } from '../stores/auth'
import { usePlanMetaStore, PLAN_META_DOC_ID } from '../stores/planMeta'
import { migrateNodes } from './useTreeHelpers'
import { SYNC_INITIAL_RETRY_MS, SYNC_MAX_RETRY_MS } from '../config/constants'

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending' | 'unauthorized'

export function useSyncManager(checklists: Ref<Checklist[]>, revCache: Map<string, string>) {
  const syncStatus = ref<SyncStatus>('offline')
  const writeError = ref<string | null>(null)

  let syncHandler: PouchDB.Replication.Sync<CouchDoc> | null = null
  let changesHandler: PouchDB.Core.Changes<CouchDoc> | null = null
  let syncRetryTimer: ReturnType<typeof setTimeout> | null = null
  let syncRetryDelay = SYNC_INITIAL_RETRY_MS
  // Sequence captured before allDocs — used to start the changes feed without gaps
  let lastSeq: string | number = 'now'
  let localLoaded = false

  // ── PouchDB helpers ─────────────────────────────────────────────────────────

  // Restores the in-memory checklist from the last successfully persisted state.
  // Returns true if a persisted version existed and was restored, false if the
  // document had never been written (e.g. a brand-new checklist whose first save failed).
  async function rollbackToPersistedState(id: string): Promise<boolean> {
    try {
      const persisted = await localDB.get<CouchDoc>(id)
      revCache.set(id, persisted._rev)
      const restored = { ...docToChecklist(persisted), items: migrateNodes(persisted.items as unknown[]) }
      const idx = checklists.value.findIndex(x => x.id === id)
      if (idx >= 0) checklists.value[idx] = restored
      return true
    } catch {
      return false
    }
  }

  // Persists a single checklist to PouchDB. Reads the rev cache synchronously, so
  // it must only ever run one-at-a-time per doc — see the upsertChecklist queue
  // below, which serializes calls so this read always happens after the previous
  // put updated the rev cache.
  async function putChecklist(c: Checklist): Promise<void> {
    // Single write choke point: stamp the LWW timestamp here so every persisted
    // revision carries a fresh modifiedAt used by conflict resolution. Capture the
    // previous value first — the 409 branch needs it to detect a cross-device edit.
    const prevModifiedAt = c.modifiedAt
    c.modifiedAt = new Date().toISOString()
    const doc = checklistToDoc(c)
    const rev = revCache.get(c.id)
    try {
      const result = await localDB.put(rev ? { ...doc, _rev: rev } : doc)
      revCache.set(c.id, result.rev)
      writeError.value = null  // clear any stale error banner on success
      return
    } catch (e) {
      if ((e as PouchDB.Core.Error).status === 409) {
        // Conflict: fetch fresh _rev and retry once.
        try {
          const existing = await localDB.get<CouchDoc>(c.id)
          revCache.set(c.id, existing._rev)
          // If the stored doc is NEWER than the version we started from, it came
          // from another device via replication — merge its items in (our edit
          // still wins field-level) so we don't clobber the other device. The
          // common case (our own stale rev cache, existing not newer) is unchanged.
          let payload: PouchDB.Core.Document<CouchDoc> & { _rev: string } = { ...doc, _rev: existing._rev }
          const existingTs = existing.modifiedAt ? Date.parse(existing.modifiedAt) || 0 : 0
          const prevTs = prevModifiedAt ? Date.parse(prevModifiedAt) || 0 : 0
          if (existingTs > prevTs) {
            payload = { ...mergeChecklistDocs(doc, existing), _rev: existing._rev }
          }
          const result = await localDB.put(payload)
          revCache.set(c.id, result.rev)
          writeError.value = null  // clear any stale error banner on retry success
          return
        } catch { /* fall through to error handler */ }
      }
    }
    // Write failed (non-409 error, or second consecutive conflict).
    const rolledBack = await rollbackToPersistedState(c.id)
    writeError.value = rolledBack
      ? 'Could not save your last change — it has been rolled back.'
      : 'Could not save a new item to local storage. It may not survive a page reload.'
  }

  // Per-id coalescing write queue. At most one put is in flight per doc; any
  // mutations arriving while a put is in flight collapse into exactly one trailing
  // put that carries the latest object reference. This removes the self-inflicted
  // 409 bursts that happened when callers fired several puts on the same doc
  // synchronously (each reading a stale rev). It adds no time-based delay — writes
  // still hit disk promptly for the offline-first case.
  const pendingWrite = new Map<string, { checklist: Checklist; promise: Promise<void>; queued: boolean }>()

  async function upsertChecklist(c: Checklist): Promise<void> {
    const entry = pendingWrite.get(c.id)
    if (entry) {
      // A write for this doc is in flight: remember the latest object (the changes
      // feed may have replaced the array element with a new reference) and mark a
      // follow-up so exactly one trailing put runs after the current one settles.
      entry.checklist = c
      entry.queued = true
      return entry.promise
    }
    const newEntry: { checklist: Checklist; promise: Promise<void>; queued: boolean } =
      { checklist: c, queued: false, promise: Promise.resolve() }
    newEntry.promise = (async () => {
      await putChecklist(newEntry.checklist)
      while (newEntry.queued) {
        newEntry.queued = false
        await putChecklist(newEntry.checklist)
      }
      pendingWrite.delete(c.id)
    })()
    pendingWrite.set(c.id, newEntry)
    return newEntry.promise
  }

  function clearWriteError(): void {
    writeError.value = null
  }

  // Deletes are rare and id-disjoint from upserts in practice, so they intentionally
  // bypass the per-id upsert queue above.
  async function removeFromLocal(id: string): Promise<void> {
    const rev = revCache.get(id)
    try {
      if (rev) {
        await localDB.remove(id, rev)
      } else {
        const doc = await localDB.get(id)
        await localDB.remove(doc)
      }
      revCache.delete(id)
    } catch { /* already gone */ }
  }

  async function loadLocal(): Promise<void> {
    // Capture seq BEFORE allDocs to avoid missing concurrent writes
    const info = await localDB.info()
    lastSeq = info.update_seq
    const result = await localDB.allDocs<CouchDoc>({ include_docs: true })
    const ids: string[] = []
    checklists.value = result.rows
      // The reserved plan-meta doc is not a checklist — the planMeta store loads
      // it itself on init; docToChecklist must never run on it.
      .filter(row => row.doc && row.id !== PLAN_META_DOC_ID)
      .map(row => {
        revCache.set(row.id, row.doc!._rev)
        const doc = row.doc!
        ids.push(row.id)
        return { ...docToChecklist(doc), items: migrateNodes(doc.items as unknown[]) }
      })
    localLoaded = true
    // Resolve any conflicts left by a prior offline sync. Each resolved put fires
    // the changes feed, which refreshes the in-memory copy with the merged result.
    for (const id of ids) await resolveConflicts(id)
  }

  // ── Conflict resolution ───────────────────────────────────────────────────────

  // Resolves CouchDB replication conflicts for a single doc. Replication can leave
  // multiple competing revisions on the same id; PouchDB picks a deterministic
  // winner but the losing revs linger forever and their changes vanish from view.
  // We pick the revision with the newest modifiedAt (missing = oldest), merge the
  // items arrays so no task is lost, put the merged winner, then delete the losers.
  //
  // Termination: this writes at most one new revision and then removes the losing
  // revs, leaving _conflicts empty. The resulting put re-triggers the changes feed,
  // but that second pass finds no _conflicts and returns without writing — so the
  // feed cannot loop.
  async function resolveConflicts(id: string): Promise<void> {
    // The plan-meta doc has no items array, so the checklist merge below would
    // corrupt it. Its fields reconcile field-level in the planMeta store instead;
    // a lingering losing revision there is harmless.
    if (id === PLAN_META_DOC_ID) return
    let current: PouchDB.Core.ExistingDocument<CouchDoc> & { _conflicts?: string[] }
    try {
      current = await localDB.get<CouchDoc>(id, { conflicts: true })
    } catch {
      return  // doc gone (e.g. deleted) — nothing to resolve
    }
    const conflictRevs = current._conflicts
    if (!conflictRevs || conflictRevs.length === 0) return  // termination guard

    // Gather all competing revisions (the current winner + every conflict rev).
    const revs: (PouchDB.Core.ExistingDocument<CouchDoc>)[] = [current]
    for (const rev of conflictRevs) {
      try {
        revs.push(await localDB.get<CouchDoc>(id, { rev }))
      } catch { /* rev already compacted away — skip */ }
    }

    // Newest modifiedAt wins; a missing modifiedAt is treated as the oldest.
    const ts = (d: CouchDoc): number => {
      const m = d.modifiedAt
      return m ? Date.parse(m) || 0 : 0
    }
    let winner = revs[0]!
    for (const d of revs) {
      if (ts(d) > ts(winner)) winner = d
    }

    // Merge every loser's items into the winner so no task disappears.
    let merged: PouchDB.Core.ExistingDocument<CouchDoc> = winner
    for (const loser of revs) {
      if (loser._rev === winner._rev) continue
      merged = mergeChecklistDocs(merged, loser)
    }

    // Put the merged winner (keeps the winner's _rev so it supersedes in place),
    // then delete each losing rev. Update the rev cache to mirror existing code.
    try {
      const put = await localDB.put(merged)
      revCache.set(id, put.rev)
    } catch {
      return  // lost a race; the next change event will retry
    }
    for (const rev of conflictRevs) {
      try {
        await localDB.remove(id, rev)
      } catch { /* already gone */ }
    }
  }

  // ── Changes feed ────────────────────────────────────────────────────────────

  function subscribeChanges(): void {
    if (changesHandler) return
    changesHandler = localDB.changes<CouchDoc>({
      since: lastSeq,
      live: true,
      include_docs: true,
    })
    .on('change', (change) => {
      // The reserved plan-meta doc is not a checklist: route it to the planMeta
      // store (obtained lazily here, mirroring useAuthStore in startSync) so a
      // review completed on another device updates this one within seconds.
      if (change.id === PLAN_META_DOC_ID) {
        if (!change.deleted && change.doc) {
          usePlanMetaStore().applyRemoteDoc(change.doc as unknown as PlanMeta & { _rev: string })
        }
        return
      }
      if (change.deleted) {
        checklists.value = checklists.value.filter(c => c.id !== change.id)
        revCache.delete(change.id)
      } else if (change.doc) {
        revCache.set(change.id, change.doc._rev)
        const cl = { ...docToChecklist(change.doc), items: migrateNodes(change.doc.items as unknown[]) }
        const idx = checklists.value.findIndex(c => c.id === change.id)
        if (idx >= 0) checklists.value[idx] = cl
        else checklists.value.push(cl)
        // Resolve any replication conflict on this doc. If none exists this is a
        // cheap no-op get; if it does, the merged put re-enters here and finds
        // _conflicts empty, so this cannot loop.
        void resolveConflicts(change.id)
      }
    })
  }

  // ── CouchDB sync ─────────────────────────────────────────────────────────────

  // Start a single sync attempt (no built-in retry). On failure we schedule a
  // restart ourselves with exponential back-off to avoid flooding the console.
  function startSync(): void {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    // Clear any pending retry timer so we don't double-start.
    if (syncRetryTimer) { clearTimeout(syncRetryTimer); syncRetryTimer = null }
    // Cancel a stale handler if any.
    if (syncHandler) { syncHandler.cancel(); syncHandler = null }

    function scheduleRetry(): void {
      if (syncRetryTimer !== null) return  // already scheduled, don't double-fire
      syncStatus.value = 'offline'
      syncHandler?.cancel()
      syncHandler = null
      const delay = syncRetryDelay
      syncRetryDelay = Math.min(syncRetryDelay * 2, SYNC_MAX_RETRY_MS)
      syncRetryTimer = setTimeout(() => {
        syncRetryTimer = null
        startSync()
      }, delay)
    }

    function isAuthError(err: unknown): boolean {
      const s = (err as { status?: number })?.status
      return s === 401 || s === 403
    }

    // Immediately shut down sync on auth failure without waiting for App.vue's
    // watcher to react. This keeps the store robust when used standalone.
    function handleAuthFailure(): void {
      if (syncRetryTimer) { clearTimeout(syncRetryTimer); syncRetryTimer = null }
      syncRetryDelay = SYNC_INITIAL_RETRY_MS
      syncHandler?.cancel()
      syncHandler = null
      syncStatus.value = 'unauthorized'
      authStore.invalidateSession()
    }

    // Intercept network failures at the fetch level (CORS/null status errors may
    // not surface through PouchDB events when retry is disabled).
    const remoteDB = createRemoteDB(() => { scheduleRetry() })
    syncStatus.value = 'syncing'

    syncHandler = localDB.sync(remoteDB, { live: true, retry: false })
      .on('paused', (err: unknown) => {
        if (err) {
          scheduleRetry()
        } else {
          // Successfully idle — reset back-off.
          syncRetryDelay = SYNC_INITIAL_RETRY_MS
          syncStatus.value = 'synced'
        }
      })
      .on('active', () => { syncStatus.value = 'syncing' })
      .on('error', (err) => {
        if (isAuthError(err)) handleAuthFailure()
        else scheduleRetry()
      })
      .on('denied', (err) => {
        if (isAuthError(err)) handleAuthFailure()
        else syncStatus.value = 'offline'
      })
  }

  async function initSync(): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || syncHandler) return

    // loadLocal() may have already run on app mount (offline/pre-auth case)
    if (!localLoaded) await loadLocal()
    subscribeChanges()

    startSync()
  }

  function unsubscribeRealtime(): void {
    if (syncRetryTimer) { clearTimeout(syncRetryTimer); syncRetryTimer = null }
    syncRetryDelay = SYNC_INITIAL_RETRY_MS
    syncHandler?.cancel()
    syncHandler = null
    changesHandler?.cancel()
    changesHandler = null
    syncStatus.value = 'offline'
  }

  return {
    syncStatus,
    writeError,
    clearWriteError,
    upsertChecklist,
    removeFromLocal,
    loadLocal,
    initSync,
    unsubscribeRealtime,
  }
}
