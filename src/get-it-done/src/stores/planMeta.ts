import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { PlanMeta } from '../types'
import { localDB } from '../lib/couchdb'

const PLAN_META_KEY = 'get-it-done-plan-meta-v1'

// Reserved CouchDB document id for the synced plan-meta doc. Lives in the same
// database as the checklists; every place that enumerates "all docs" must skip
// this id so it is never treated as a checklist.
export const PLAN_META_DOC_ID = 'plan-meta'

function loadPlanMeta(): PlanMeta {
  try {
    const raw = localStorage.getItem(PLAN_META_KEY)
    if (!raw) return { dayPlanDate: null }
    return JSON.parse(raw) as PlanMeta
  } catch {
    return { dayPlanDate: null }
  }
}

// The shape we store in CouchDB: the PlanMeta fields under a reserved _id. _rev
// is present once the doc exists. We keep a private rev cache so persistPlanMeta
// can put without an extra get in the common case.
type PlanMetaDoc = PlanMeta & { _id: typeof PLAN_META_DOC_ID; _rev?: string }

// The shared database is typed for checklist docs; this handle views it as
// holding the plan-meta shape for the few reads/writes below.
const metaDB = localDB as unknown as PouchDB.Database<PlanMetaDoc>

export const usePlanMetaStore = defineStore('planMeta', () => {
  const planMeta = ref<PlanMeta>(loadPlanMeta())

  // Tracks the _rev of the persisted plan-meta doc so persistPlanMeta can put
  // without an extra get round-trip in the common case.
  let docRev: string | undefined

  // Later of two plan dates, nulls ignored. A plan date only matters when it is
  // today, and a later date is always at least as fresh, so "max of non-null" is a
  // safe, commutative merge: a stale or cleared (null) value can never erase a
  // fresher one, whichever device or revision it comes from.
  function laterDate(a: string | null | undefined, b: string | null | undefined): string | null {
    if (a == null) return b ?? null
    if (b == null) return a
    return b > a ? b : a
  }

  // Merge an incoming plan-meta doc (from local get on init, or from the changes
  // feed on remote update) into the reactive state. Only assigns when a field
  // actually changes value, so an identical doc does NOT trigger the deep watcher
  // → persist → put → changes-feed loop. Returns true if anything changed.
  // weekPlanDate is intentionally not merged — see persistToDB.
  function applyDoc(doc: PlanMeta): boolean {
    const merged = laterDate(planMeta.value.dayPlanDate, doc.dayPlanDate)
    if (merged === planMeta.value.dayPlanDate) return false
    planMeta.value.dayPlanDate = merged
    return true
  }

  // Brings the synced doc in line with this device: merges every competing
  // revision (replication conflicts — CouchDB picks an arbitrary winner, and the
  // Sticky / other devices only read that winner), then writes the merged date
  // back if the doc lags behind what we hold, and tombstones the losing revisions.
  // Without this write-back a date that only reached localStorage (a failed put,
  // a stale device that nulled the doc) would never reach CouchDB again.
  async function reconcileDB(): Promise<void> {
    let current: PouchDB.Core.ExistingDocument<PlanMetaDoc> & { _conflicts?: string[] }
    try {
      current = await metaDB.get(PLAN_META_DOC_ID, { conflicts: true })
    } catch {
      // No synced doc yet (fresh install, or offline before first replication):
      // create it from the localStorage seed if that holds a date.
      if (planMeta.value.dayPlanDate) await persistToDB()
      return
    }
    docRev = current._rev
    applyDoc(current)
    const conflictRevs = current._conflicts ?? []
    for (const rev of conflictRevs) {
      try {
        applyDoc(await metaDB.get(PLAN_META_DOC_ID, { rev }))
      } catch { /* rev compacted away — skip */ }
    }
    if (current.dayPlanDate !== planMeta.value.dayPlanDate) await persistToDB()
    for (const rev of conflictRevs) {
      try {
        await metaDB.remove(PLAN_META_DOC_ID, rev)
      } catch { /* already gone */ }
    }
  }

  // Resolves once the synced doc has been read and reconciled on init. Callers
  // that act on the plan date (refreshDayPlanIfStale) must await it: acting on the
  // bare localStorage seed can see a stale date and clear a fresh plan.
  const ready: Promise<void> = reconcileDB().catch(() => { /* non-fatal */ })

  // Called by the changes feed when a plan-meta doc replicates in from another
  // device. Merges it in place (so isDayPlanFresh recomputes) and, if the doc is
  // behind us or carries conflicts, reconciles — e.g. a stale device that wrote
  // null over today's date gets today's date back instead of silently diverging.
  function applyRemoteDoc(doc: PlanMeta & { _rev: string; _conflicts?: string[] }): void {
    docRev = doc._rev
    applyDoc(doc)
    if (doc.dayPlanDate !== planMeta.value.dayPlanDate || (doc._conflicts?.length ?? 0) > 0) {
      void reconcileDB()
    }
  }

  // Writes the localStorage fallback synchronously, then upserts the synced
  // CouchDB doc (get → put with _rev, one 409 retry taking the freshest doc as
  // base). Does NOT reuse the checklist upsert queue — plan-meta is a single doc.
  function persistPlanMeta(): void {
    localStorage.setItem(PLAN_META_KEY, JSON.stringify(planMeta.value))
    void persistToDB()
  }

  async function persistToDB(): Promise<void> {
    // weekPlanDate is intentionally omitted: the week-plan feature was removed
    // (issue 012), so the field is vestigial. Syncing it would ping-pong stale
    // per-device values (pre-sync localStorage seeds) between devices forever.
    // PlanMeta still types it as optional, so an absent field is valid.
    const body = (): PlanMetaDoc => ({
      _id: PLAN_META_DOC_ID,
      dayPlanDate: planMeta.value.dayPlanDate,
    })
    try {
      const res = await metaDB.put(docRev ? { ...body(), _rev: docRev } : body())
      docRev = res.rev
    } catch (e) {
      if ((e as PouchDB.Core.Error).status === 409) {
        // Conflict: the doc moved under us (another device). Merge its date
        // first — never overwrite a fresher date with an older one or null —
        // then retry once with its _rev.
        try {
          const existing = await metaDB.get(PLAN_META_DOC_ID)
          docRev = existing._rev
          applyDoc(existing)
          const res = await metaDB.put({ ...body(), _rev: existing._rev })
          docRev = res.rev
        } catch { /* give up; localStorage still holds the value */ }
      }
      // Non-409 errors (offline IndexedDB failure, etc.) are non-fatal — the
      // localStorage write above already succeeded.
    }
  }

  // Persist on any mutation, wherever it happens — callers no longer make manual
  // persistPlanMeta() calls. applyDoc only assigns on real value changes, so a
  // doc arriving from the changes feed with identical values does not re-persist.
  watch(planMeta, persistPlanMeta, { deep: true })

  return { planMeta, ready, persistPlanMeta, applyRemoteDoc }
})
