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

  // Merge an incoming plan-meta doc (from local get on init, or from the changes
  // feed on remote update) into the reactive state. Only assigns when a field
  // actually changes value, so an identical doc does NOT trigger the deep watcher
  // → persist → put → changes-feed loop. Returns true if anything changed.
  function applyDoc(doc: PlanMeta): boolean {
    let changed = false
    // dayPlanDate: adopt the incoming date only when it is non-null AND strictly
    // later (lexicographic, YYYY-MM-DD) than what we hold — the later date is the
    // fresher plan. Using a deterministic max (rather than prefer-incoming) makes
    // the merge commutative/idempotent: two devices holding different dates both
    // converge to the later one instead of oscillating in a period-2 swap.
    // weekPlanDate is intentionally not merged — see persistToDB.
    if (
      doc.dayPlanDate != null &&
      (planMeta.value.dayPlanDate == null || doc.dayPlanDate > planMeta.value.dayPlanDate)
    ) {
      planMeta.value.dayPlanDate = doc.dayPlanDate
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
  // real change), so isDayPlanFresh recomputes automatically.
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
    // weekPlanDate is intentionally omitted: the week-plan feature was removed
    // (issue 012), so the field is vestigial. Syncing it would ping-pong stale
    // per-device values (pre-sync localStorage seeds) between devices forever.
    // PlanMeta still types it as optional, so an absent field is valid.
    const body: PlanMetaDoc = {
      _id: PLAN_META_DOC_ID,
      dayPlanDate: planMeta.value.dayPlanDate,
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
