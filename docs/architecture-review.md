# Data Flow & Architecture Review

**Date:** 2026-05-21  
**Scope:** Full read of stores, composables, lib, and representative components.

---

## 1. Architecture Overview

The app is organised in three layers that compose cleanly:

```
┌─────────────────────────────────────────────────────────────────┐
│  Vue components (App.vue → template views → organisms → atoms)  │
│  Consume store via storeToRefs / direct action calls            │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Pinia
┌──────────────────────────────▼──────────────────────────────────┐
│  useChecklistStore (stores/checklists.ts)                        │
│  · owns checklists: Ref<Checklist[]> and revCache               │
│  · delegates sync to useSyncManager                             │
│  · delegates task/day-plan logic to useDayPlanning              │
│  · re-exports everything through a single public API            │
└───────────┬────────────────────────────────────┬────────────────┘
            │                                    │
┌───────────▼──────────┐           ┌─────────────▼──────────────┐
│  useSyncManager      │           │  useDayPlanning             │
│  (PouchDB + CouchDB) │           │  (task tracking / day plan) │
└──────────────────────┘           └────────────────────────────┘
```

`useAuthStore` (auth, session) and `usePlanMetaStore` (localStorage-persisted
planning metadata) are independent stores consumed by the composables above.

---

## 2. Data Model

### 2.1 PouchDB document (one per checklist)

```
CouchDoc = Checklist with id → _id
```

Every checklist is stored as a **single denormalized document** in PouchDB / CouchDB.
Items live inline as a recursive tree — no separate collection, no foreign keys.

```
Checklist {
  id, kind, title, archived, createdAt, archivedAt,
  templateId, runLabel, tracked, defaultPriority, defaultEffort,
  items: ChecklistNode[]
}

ChecklistNode = ChecklistItem | ChecklistItemGroup

ChecklistItem {
  type: 'item', id, text, done,
  // present only when parent.tracked === true:
  priority?, effort?, status?, selectedForToday?,
  snoozeUntil?, snoozedAt?, completedAt?, deadline?, reminders?
}

ChecklistItemGroup {
  type: 'group', id, title, collapsed,
  children: ChecklistNode[]   // recursive
}
```

**Design choice rationale:** denormalization simplifies templates/runs (clone the
whole document), avoids join queries, and maps naturally to PouchDB's
document-per-entity model. The cost is that any write to a single item rewrites
the entire checklist document — acceptable at current scale.

### 2.2 Out-of-band state

| What | Where | Synced? |
|---|---|---|
| `checklists` array | PouchDB (IndexedDB) ↔ CouchDB | Yes |
| `revCache` | In-memory `Map<string,string>` | No (rebuilt from DB on load) |
| `planMeta` (dayPlanDate, lastReviewedAt) | `localStorage` key `get-it-done-plan-meta-v1` | No |
| `dismissedUntil` (12-h day-plan dismissals) | In-memory `reactive<Record<string,number>>` | No |
| Auth session | CouchDB cookie | Via HTTP |

---

## 3. Data Flow

### 3.1 App startup (offline-first)

```
onMounted (App.vue:99)
  1. await checklistStore.loadLocal()
       ├─ localDB.info() → capture lastSeq (gap prevention)
       ├─ localDB.allDocs() → populate checklists.value + revCache
       └─ migrateNodes() on each document
  2. checklistStore.processDueSnoozed()   // snoozed→active transitions
  3. checklistStore.refreshDayPlanIfStale()
  4. await authStore.checkSession()
  5. if authenticated:
       └─ await checklistStore.initSync()
            ├─ subscribeChanges() (live changes feed from lastSeq)
            └─ startSync() (live PouchDB↔CouchDB replication)
```

Data is available and usable before network auth completes — true offline-first.

### 3.2 Mutation lifecycle

Every mutation follows the same optimistic pattern:

```
store action (e.g. toggleItem)
  1. findItemDeep() — O(n) tree walk
  2. mutate item in-place (immediate Vue reactivity)
  3. void sync.upsertChecklist(checklist)   ← fire-and-forget
       ├─ localDB.put({ ...doc, _rev: revCache.get(id) })
       ├─ on 409: fetch fresh _rev, retry once
       └─ update revCache on success
```

Computed views (`trackedItems`, `activeTrackedItems`, etc.) re-evaluate
immediately because they depend on `checklists` ref. The DB write happens in the
background; no spinner, no await.

### 3.3 Remote change ingestion

```
CouchDB change arrives → PouchDB replication pulls it
  → localDB changes feed fires (subscribeChanges, useSyncManager.ts:79)
  → revCache updated
  → checklists.value[idx] replaced with new Checklist object
  → all computed views re-evaluate reactively
```

The `lastSeq` capture before `allDocs()` (useSyncManager.ts:57–58) prevents a
race where a write between the info() call and the allDocs() result would be
missed by the changes feed.

### 3.4 Component ↔ store wiring

`App.vue` uses `storeToRefs` to destructure all computed refs, then passes them
as props to template-level components. Events emitted from leaf components
(`TaskCard`, `ItemRow`) bubble up to `App.vue`, which calls store actions
directly. The chain is:

```
TaskCard emit → DayView forward → TasksView forward → App.vue → store.action()
```

For non-task views (`ActiveView`, `TemplatesView`, `ArchiveView`), components
call `useChecklistStore()` directly — which is the recommended Pinia pattern and
avoids unnecessary prop tunnelling.

### 3.5 Day plan suggestion algorithm

`suggestDayPlan()` (useDayPlanning.ts:272) is a three-phase imperative function
(not a computed — it includes `Math.random()` intentionally for variance):

1. **Keep** already-selected items; subtract their effort from the budget (4 S-units).
2. **Mandatory** items (deadline ≤ tomorrow) are always included regardless of budget.
3. **Score** remaining items: `priorityScore + deadlineBonus + Math.random()`, sort
   DESC, fill greedily. Exception: a single Large task may be the sole pick.

Effort units: Small=1, Medium=3, Large=9. Budget=4 (roughly 1M+1S or 4S).

---

## 4. Issues

### HIGH

#### H1 — Optimistic mutations have no rollback path

**Where:** Every action in `useDayPlanning.ts` via `withItem()` (line 74–81) and
directly in `toggleItem` (stores/checklists.ts:214), `clearDayPlan`
(useDayPlanning.ts:191–196), `setDayPlan` (useDayPlanning.ts:215–233), and
`refreshDayPlanIfStale` (useDayPlanning.ts:235–246).

**Pattern:** The in-memory object is mutated synchronously; `upsertChecklist` is
called with `void` (fire-and-forget). If the PouchDB write throws (e.g., storage
quota exceeded, IndexedDB corruption), the UI shows the mutated state but the
change is never persisted. On next reload the data reverts silently.

**Risk:** Data loss on write failure, with no user feedback and no retry.

**Recommendation:** At minimum, catch errors from `upsertChecklist` and surface
them via a reactive `lastError` ref that the UI can display. Full rollback (save
snapshot before mutation, restore on failure) would be ideal for critical actions
like `toggleItem` and `setDayPlan`.

---

#### H2 — Conflict retry exhausted silently

**Where:** `useSyncManager.ts:31–39`

```typescript
} catch (e) {
  if ((e as PouchDB.Core.Error).status === 409) {
    const existing = await localDB.get(c.id)
    revCache.set(c.id, existing._rev)
    const result = await localDB.put({ ...doc, _rev: existing._rev })
    revCache.set(c.id, result.rev)
  }
  // ← non-409 errors and second conflicts fall through silently
}
```

The retry block itself is not wrapped in try/catch. A second 409 (concurrent
write between the `get` and the second `put`) or any other error from the
`get`/`put` calls propagates as an unhandled rejection. In practice this is
caught by the calling `void`, so the write is silently dropped.

**Risk:** Under rapid concurrent edits (two tabs, mobile + desktop) a write can
be lost with no indication.

**Recommendation:** Wrap the retry block in its own try/catch; log or surface
failures. Consider a short loop (3 attempts) before giving up.

---

#### H3 — `dayPlanItems` includes archived checklists; `trackedItems` does not

**Where:** `useDayPlanning.ts:107–128` vs. `useDayPlanning.ts:85–95`

`trackedItems` (line 88) skips archived checklists. `dayPlanItems` then
deliberately re-scans archived checklists (lines 117–125) to include items
completed today. This secondary scan uses the same `checklists.value` loop but
with no shared abstraction — it is easy to miss when modifying either computed.

**Side effects:** `dueSnoozedItems` and `staleSnoozedItems` are derived from
`trackedItems`, so they correctly exclude archived. But `weeklyReviewDue`
consumes `dueSnoozedItems`, so archived checklists never trigger a review prompt
even if they have overdue snoozed items at the moment of archiving.

**Recommendation:** Extract the archived-completed scan into a named computed
(`archivedTodayItems`) and compose `dayPlanItems` from `trackedItems` +
`archivedTodayItems` so the intent is explicit and both paths share the same
filter logic.

---

### MEDIUM

#### M1 — Event bubble chain for all task mutations

**Where:** `App.vue:225–239`, `TasksView.vue`, `DayView.vue`

All task mutations (toggle, snooze, priority, effort, text, deadline) travel
through three layers of `$emit` forwarding before reaching the store — despite
Pinia being globally accessible. `TaskCard` could call `useChecklistStore()`
directly, cutting ~40 lines of forwarded event declarations across three files
and making the data flow easier to trace.

The current pattern also means adding a new action requires changes in four
files: the component, the organism, the template, and `App.vue`.

**Recommendation:** Have leaf components call `useChecklistStore()` directly for
mutations; reserve prop/emit for data that is genuinely computed at a parent
level (e.g., `dismissedKeys`, `isDayPlanFresh`).

---

#### M2 — `MobilePlanningSheet` duplicates and watches store state

**Where:** `src/components/molecules/MobilePlanningSheet.vue`

The component creates local `ref` copies of `props.item.text`, `props.item.priority`,
and a derived `pendingDeadlineDate`, then syncs them with `watch()` calls. This
is a three-way state sync (store → prop → local ref → confirm → emit → store)
with a lag window between prop change and watcher execution where the component
shows stale data.

**Recommendation:** If the pattern is to allow uncommitted edits, initialise the
local refs from `props.item` on mount only (`const pendingText =
ref(props.item.text)`) and drop the watchers — the component is only mounted
while the sheet is open, so it cannot go stale mid-session. If the item can
change externally while the sheet is open, document why and add a comment.

---

#### M3 — `dismissedUntil` is in-memory only *(will not be implemented)*

**Where:** `useDayPlanning.ts:29–31, 184`

Dismissed day-plan items (manually removed from today's plan) are stored in a
reactive `Record<string,number>` keyed by `` `${checklistId}:${itemId}` ``.
The dismissal is lost on page reload — a user who removes an item from today's
plan and then reloads will see it reappear in the suggestion on the next
"Suggest" click.

**Decision:** Session-only dismissal is intentional product behaviour. The 12-hour
window exists to de-noise the Suggest algorithm within a single work session;
after a page reload the user is in a new context and Suggest should consider
the full active backlog again. No change planned.

---

#### M4 — Manual `persistPlanMeta()` calls can be forgotten

**Where:** `useDayPlanning.ts:211, 232, 244, 267`

Each action that modifies `planMeta` must call `persistPlanMeta()` explicitly.
There is no automatic flush. A new action that updates `planMeta` but forgets the
call will silently lose the change on reload.

**Recommendation:** Add a `watch(planMeta, () => persistPlanMeta(), { deep: true })`
in `usePlanMetaStore` so persistence is automatic. Remove the four manual calls.

---

### LOW

#### L1 — Cascade delete of template runs is local-only

**Where:** `stores/checklists.ts:106–122`

`deleteChecklist` removes the template and all its runs from `checklists.value`,
then calls `removeFromLocal` for each. If the `removeFromLocal` PouchDB call
for a run fails (or sync is interrupted), the run document remains in CouchDB
and will be re-pulled on the next sync, resurrecting deleted runs.

**Recommendation:** Consider a tombstone pattern (set `archived=true` and a
`deletedAt` timestamp instead of a hard delete) or verify that all `removeFromLocal`
calls succeed before removing from the in-memory array.

---

#### L2 — `migrateNodes()` runs on every `loadLocal()` regardless

**Where:** `useSyncManager.ts:65, 85`

`migrateNodes()` is called for every document during `loadLocal()` and on every
change feed event. For databases that have already been migrated this is a no-op,
but it adds a small overhead on every remote change.

**Recommendation:** Once the migration is confirmed complete in production, remove
the call and delete the migration function (or gate it behind a schema version
field in the document).

---

#### L3 — `suggestDayPlan()` includes `Math.random()` in scoring

**Where:** `useDayPlanning.ts:52`

The random component is intentional (adds variance to tie-breaking) but means
the function is not pure and cannot be unit-tested deterministically. The random
call also fires inside `scoreItem` which is called inside `.map()` — the same
item gets a different score each call, so calling `suggestDayPlan()` twice in
quick succession can produce different results for the same backlog.

This is a product decision more than a bug, but it should be documented.
Consider accepting a `seed` or `jitter` parameter that defaults to
`Math.random()` — this makes the function testable without changing behaviour.

---

#### L4 — No depth limit on `ChecklistItemGroup` nesting

**Where:** `stores/checklists.ts:298–317`, `useTreeHelpers.ts`

`walkNodes` and `findItemDeep` are recursive with no depth guard. Pathologically
nested documents (unlikely in practice) could stack-overflow. More practically,
the PouchDB document grows quadratically with group depth. A soft limit (e.g.,
max 3 levels) enforced in `addGroup` would prevent accidental misuse.

---

## 5. Strengths

- **Reactivity chain is clean.** `checklists` ref → `trackedItems` computed →
  `activeTrackedItems` → `itemsByPriority` forms a correct dependency graph. Vue
  invalidates only what changed; no manual `watch` chains in the hot path.

- **`revCache` avoids read-before-write.** Caching `_rev` in memory means the
  common path (single writer, no conflicts) requires zero extra PouchDB reads per
  mutation. The cache is populated on `loadLocal()` and kept current by the
  changes feed.

- **`lastSeq` captured before `allDocs`.** `useSyncManager.ts:57–58` correctly
  records the update sequence *before* reading all documents, so the changes feed
  started afterward cannot miss a write that arrived between the two operations.

- **Exponential backoff is self-managed.** Using `live: true, retry: false` with
  a manual retry timer (useSyncManager.ts:106–117) gives full control over back-off
  behaviour (5 s → 60 s). PouchDB's built-in retry is opaque and hard to observe.

- **Session keep-alive prevents stale cookies.** The 5-minute ping
  (App.vue:34–44) keeps the CouchDB session alive during long idle periods
  without requiring the user to re-authenticate.

- **Auth failure is handled immediately.** `handleAuthFailure` (useSyncManager.ts:126–133)
  cancels sync and calls `authStore.invalidateSession()` synchronously on
  any 401/403, preventing the store from queuing writes against an expired session.

- **Offline-first init sequence is correct.** Local data loads before the auth
  check — the app is usable even if CouchDB is unreachable.

- **TypeScript strict mode throughout.** Discriminated unions on `ChecklistNode`
  (`type: 'item' | 'group'`) catch exhaustiveness errors at compile time.
  `noUnusedLocals` and `noUnusedParameters` prevent dead code accumulation.

---

## 6. Recommendations (prioritised)

| Priority | Action | File(s) |
|---|---|---|
| **1** | Add error handling + user feedback for failed `upsertChecklist` calls | `useSyncManager.ts`, `stores/checklists.ts` |
| **2** | Wrap the conflict-retry block in its own try/catch; log or surface failures | `useSyncManager.ts:31–39` |
| **3** | Auto-persist `planMeta` with a deep watcher; remove manual `persistPlanMeta()` calls | `stores/planMeta.ts`, `useDayPlanning.ts` |
| ~~4~~ | ~~Persist `dismissedUntil` (session-only vs. day-persistent)~~ | *will not implement — session-only is intentional* |
| **5** | Extract `archivedTodayItems` computed; compose `dayPlanItems` from named parts | `useDayPlanning.ts:107–128` |
| **6** | Move task mutations into leaf components; remove event forwarding chain | `TaskCard.vue`, `DayView.vue`, `TasksView.vue`, `App.vue` |
| **7** | Remove `migrateNodes()` call once migration is verified complete in production | `useSyncManager.ts:65, 85` |
| **8** | Add max-depth guard in `addGroup` | `stores/checklists.ts:298` |
