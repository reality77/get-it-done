import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Checklist } from '../types'
import { localDB, createRemoteDB, checklistToDoc, docToChecklist } from '../lib/couchdb'
import type { CouchDoc } from '../lib/couchdb'
import { useAuthStore } from '../stores/auth'
import { migrateNodes } from './useTreeHelpers'
import { SYNC_INITIAL_RETRY_MS, SYNC_MAX_RETRY_MS } from '../config/constants'

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending' | 'unauthorized'

export function useSyncManager(checklists: Ref<Checklist[]>, revCache: Map<string, string>) {
  const syncStatus = ref<SyncStatus>('offline')

  let syncHandler: PouchDB.Replication.Sync<CouchDoc> | null = null
  let changesHandler: PouchDB.Core.Changes<CouchDoc> | null = null
  let syncRetryTimer: ReturnType<typeof setTimeout> | null = null
  let syncRetryDelay = SYNC_INITIAL_RETRY_MS
  // Sequence captured before allDocs — used to start the changes feed without gaps
  let lastSeq: string | number = 'now'
  let localLoaded = false

  // ── PouchDB helpers ─────────────────────────────────────────────────────────

  async function upsertChecklist(c: Checklist): Promise<void> {
    const doc = checklistToDoc(c)
    const rev = revCache.get(c.id)
    try {
      const result = await localDB.put(rev ? { ...doc, _rev: rev } : doc)
      revCache.set(c.id, result.rev)
    } catch (e) {
      if ((e as PouchDB.Core.Error).status === 409) {
        // Conflict: fetch fresh _rev and retry once
        const existing = await localDB.get(c.id)
        revCache.set(c.id, existing._rev)
        const result = await localDB.put({ ...doc, _rev: existing._rev })
        revCache.set(c.id, result.rev)
      }
    }
  }

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
    checklists.value = result.rows
      .filter(row => row.doc)
      .map(row => {
        revCache.set(row.id, row.doc!._rev)
        const doc = row.doc!
        return { ...docToChecklist(doc), items: migrateNodes(doc.items as unknown[]) }
      })
    localLoaded = true
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
      if (change.deleted) {
        checklists.value = checklists.value.filter(c => c.id !== change.id)
        revCache.delete(change.id)
      } else if (change.doc) {
        revCache.set(change.id, change.doc._rev)
        const cl = { ...docToChecklist(change.doc), items: migrateNodes(change.doc.items as unknown[]) }
        const idx = checklists.value.findIndex(c => c.id === change.id)
        if (idx >= 0) checklists.value[idx] = cl
        else checklists.value.push(cl)
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
    upsertChecklist,
    removeFromLocal,
    loadLocal,
    initSync,
    unsubscribeRealtime,
  }
}
