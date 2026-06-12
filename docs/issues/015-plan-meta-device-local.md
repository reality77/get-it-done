# 015 — `planMeta` is per-device localStorage while the flags it governs are synced

| | |
|---|---|
| **Type** | Design issue (multi-device inconsistency) |
| **Severity** | Low–Medium |
| **Confidence** | High |
| **Effort** | Medium |
| **Files** | `src/get-it-done/src/stores/planMeta.ts`, `src/get-it-done/src/composables/useDayPlanning.ts`, `src/get-it-done/src/composables/useSyncManager.ts`, `src/get-it-done/src/lib/couchdb.ts` |

## Problem

`PlanMeta` (`lastReviewedAt`, `dayPlanDate`, `weekPlanDate`) lives in **localStorage**
(`get-it-done-plan-meta-v1`), per device. But the state it interprets — `selectedForToday` flags on
items — is **synced** through CouchDB. Concrete inconsistencies:

1. **Stale plans stick on passive devices.** Device A plans Monday's day; flags sync to device B.
   B is not opened on Monday. B's `planMeta.dayPlanDate` is `null`/old, so when B opens on
   Wednesday, `refreshDayPlanIfStale()` sees `planMeta.dayPlanDate == null` → does **nothing** → B
   shows Monday's plan as "today" until A happens to reset it (and even A's reset isn't persisted —
   see issue 004; fix that first).
2. **Weekly review nags per device.** Completing the review on the phone doesn't update
   `lastReviewedAt` on the laptop; the banner re-appears there.
3. There is also a latent papercut already noted in `docs/architecture-review.md` (M4): persistence
   requires manual `persistPlanMeta()` calls that are easy to forget.

## Fix — store planMeta as a synced CouchDB document

Move `PlanMeta` into the existing database as a dedicated doc, so it replicates like everything
else:

1. **Reserved doc id:** `plan-meta` (string constant `PLAN_META_DOC_ID` exported from
   `stores/planMeta.ts`).
2. **`planMeta.ts` rewrite:**
   - Keep the same store name (`'planMeta'`) and the same public shape:
     `{ planMeta, persistPlanMeta }` — callers must not change.
   - On store init: synchronously start from localStorage (fast, offline-first, preserves existing
     users' values), then asynchronously `localDB.get(PLAN_META_DOC_ID)` and overwrite fields if
     the doc exists and its values are *newer* (`lastReviewedAt` lexicographic max; for
     `dayPlanDate`/`weekPlanDate` prefer the doc's value when present).
   - `persistPlanMeta()`: write localStorage (keep — it is the synchronous fallback) **and**
     upsert the CouchDB doc (get → put with `_rev`, retry once on 409 taking the freshest doc as
     base — same pattern as `upsertChecklist`).
   - Add `watch(planMeta, persistPlanMeta, { deep: true })` and remove **all** manual
     `persistPlanMeta()` calls in `useDayPlanning.ts` (grep for them — there are ~6; some may
     already be gone if issue 012 landed). This also closes architecture-review M4.
3. **Exclude the doc from checklist loading.** This is the critical integration point:
   - `loadLocal()` and the changes-feed handler in `useSyncManager.ts` currently treat **every**
     row/change as a checklist. Add an explicit guard: `if (row.id === PLAN_META_DOC_ID) ...` —
     skip it in the checklist array, and in the changes handler instead refresh the planMeta store
     from `change.doc` (import the store lazily inside the handler, mirroring how `useAuthStore`
     is obtained inside `startSync`).
   - `docToChecklist` must never be called on the plan-meta doc.
4. **Reactivity on remote update:** when the changes feed delivers a newer plan-meta doc (the other
   device completed a review), update `planMeta` fields in place; `weeklyReviewDue` recomputes
   automatically.

## Guardrails — read before editing

- The localStorage layer **stays** (read fallback + synchronous first paint). Do not delete the
  `PLAN_META_KEY` handling; only layer the synced doc on top.
- Do not put plan-meta into a separate database — same DB, reserved id, or replication/auth setup
  would need changes.
- Guard every place that enumerates "all docs" — at analysis time exactly two: the `allDocs` loop
  in `loadLocal()` and the `on('change')` handler. Re-grep `allDocs|on\('change'` in
  `useSyncManager.ts` to confirm none were added since.
- The push server scans the same DB with `_all_docs` (`src/push-server/src/couch.ts`); its loops
  guard with `doc?.items` checks, so a plan-meta doc (no `items`) is already skipped — verify,
  don't change.
- Watch out for write loops: changes-feed → update planMeta → deep watcher → persist → put → feed.
  Prevent it by comparing values before assigning in the feed handler (only assign if different) —
  assignment of identical values still triggers a deep watcher in Vue only if a write occurs, so
  skip identical writes explicitly.
- If issue 012 landed, `weekPlanDate` may no longer be written; keep the field tolerated either
  way.
- If issue 007/004 are pending, they touch neighboring lines in `useDayPlanning.ts` — coordinate.

## Acceptance criteria

- Two synced browser profiles: complete the weekly review in one → within a few seconds the other
  profile's review banner disappears (while open) or does not reappear (on next load).
- Day-plan staleness: plan a day in profile A; advance the clock a day (or fake
  `planMeta.dayPlanDate`); open profile B → B clears the stale plan because the synced
  `dayPlanDate` is visible to it.
- Fresh profile with legacy localStorage planMeta but no CouchDB doc: values are preserved and the
  doc gets created on first persist.
- `cd src/get-it-done && npm run build` passes with zero errors.
