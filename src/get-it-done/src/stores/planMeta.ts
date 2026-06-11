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
    if (!raw) return { lastReviewedAt: null, dayPlanDate: null }
    return JSON.parse(raw) as PlanMeta
  } catch {
    return { lastReviewedAt: null, dayPlanDate: null }
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

  // Lexicographic max of two nullable ISO timestamps; null is treated as oldest.
  function newer(a: string | null | undefined, b: string | null | undefined): string | null {
    if (a == null) return b ?? null
    if (b == null) return a
    return a >= b ? a : b
  }

  // Merge an incoming plan-meta doc (from local get on init, or from the changes
  // feed on remote update) into the reactive state. Only assigns when a field
  // actually changes value, so an identical doc does NOT trigger the deep watcher
  // → persist → put → changes-feed loop. Returns true if anything changed.
  function applyDoc(doc: PlanMeta): boolean {
    let changed = false
    // lastReviewedAt: keep the lexicographically newest of the two.
    const mergedReview = newer(planMeta.value.lastReviewedAt, doc.lastReviewedAt)
    if (mergedReview !== planMeta.value.lastReviewedAt) {
      planMeta.value.lastReviewedAt = mergedReview
      changed = true
    }
    // dayPlanDate / weekPlanDate: prefer the doc's value when present.
    if (doc.dayPlanDate != null && doc.dayPlanDate !== planMeta.value.dayPlanDate) {
      planMeta.value.dayPlanDate = doc.dayPlanDate
      changed = true
    }
    if (doc.weekPlanDate != null && doc.weekPlanDate !== planMeta.value.weekPlanDate) {
      planMeta.value.weekPlanDate = doc.weekPlanDate
      changed = true
    }
    return changed
  }

  // Asynchronously load the synced doc on init and overwrite fields if it is
  // newer than the localStorage seed. Records the _rev for later puts.
  async function loadFromDB(): Promise<void> {
    try {
      const doc = await metaDB.get(PLAN_META_DOC_ID)
      docRev = doc._rev
      applyDoc(doc)
    } catch {
      // No synced doc yet (fresh install, or offline before first replication).
      // localStorage seed already loaded; the doc is created on first persist.
    }
  }
  void loadFromDB()

  // Called by the changes feed when a newer plan-meta doc replicates in from
  // another device. Updates the _rev cache and merges fields in place (only on
  // real change), so weeklyReviewDue / isDayPlanFresh recompute automatically.
  function applyRemoteDoc(doc: PlanMeta & { _rev: string }): void {
    docRev = doc._rev
    applyDoc(doc)
  }

  // Writes the localStorage fallback synchronously, then upserts the synced
  // CouchDB doc (get → put with _rev, one 409 retry taking the freshest doc as
  // base). Does NOT reuse the checklist upsert queue — plan-meta is a single doc.
  function persistPlanMeta(): void {
    localStorage.setItem(PLAN_META_KEY, JSON.stringify(planMeta.value))
    void persistToDB()
  }

  async function persistToDB(): Promise<void> {
    const body: PlanMetaDoc = {
      _id: PLAN_META_DOC_ID,
      lastReviewedAt: planMeta.value.lastReviewedAt,
      dayPlanDate: planMeta.value.dayPlanDate,
      weekPlanDate: planMeta.value.weekPlanDate ?? null,
    }
    try {
      const res = await metaDB.put(docRev ? { ...body, _rev: docRev } : body)
      docRev = res.rev
    } catch (e) {
      if ((e as PouchDB.Core.Error).status === 409) {
        // Conflict: re-read the freshest doc, retry once with its _rev.
        try {
          const existing = await metaDB.get(PLAN_META_DOC_ID)
          docRev = existing._rev
          const res = await metaDB.put({ ...body, _rev: existing._rev })
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

  return { planMeta, persistPlanMeta, applyRemoteDoc }
})
