# 013 — Sync has no conflict strategy: whole-doc LWW clobbering, unresolved CouchDB conflicts, standalone-checklist first-sync collision

| | |
|---|---|
| **Type** | Architecture |
| **Severity** | Medium (silent data loss windows in multi-device use) |
| **Confidence** | High (by construction; scenarios below are deterministic) |
| **Effort** | Large — implement in the phases listed; each phase ships independently |
| **Files** | `src/get-it-done/src/composables/useSyncManager.ts`, `src/get-it-done/src/lib/couchdb.ts`, `src/get-it-done/src/stores/checklists.ts` (`ensureStandaloneChecklist`) |

## Problem — three concrete loss scenarios

### A. Local 409 retry blindly overwrites

`upsertChecklist` in `useSyncManager.ts`, on a 409 conflict, refetches `_rev` and re-puts **our**
document:

```ts
const existing = await localDB.get(c.id)
revCache.set(c.id, existing._rev)
const result = await localDB.put({ ...doc, _rev: existing._rev })
```

If the conflicting revision came from *another device via replication* (not from our own stale
rev cache), this wholesale overwrites the other device's changes to the entire checklist — the doc
is the whole checklist, so editing *item A* on device 1 can erase an edit to *item B* made on
device 2 in the same window.

### B. Replication conflicts are never detected or resolved

`localDB.sync(remoteDB, ...)` will create CouchDB conflict revisions when both sides edited the
same doc offline. PouchDB then deterministically picks an arbitrary winner; the losing revision's
changes silently disappear from view but **remain in the database forever** (never queried with
`conflicts: true`, never deleted). No code anywhere mentions `_conflicts`.

### C. The standalone checklist collides on every new device

`ensureStandaloneChecklist()` (`stores/checklists.ts`) runs at app mount, **before** first sync, and
creates a doc with the fixed id `00000000-0000-0000-0000-000000000001` if none exists locally. On a
brand-new device this always creates a fresh rev-1 doc; when replication then pulls the existing
remote standalone doc, the two independent revision trees merge into a guaranteed conflict. Any
standalone tasks the user added on the new device before logging in sit in whichever revision
loses — i.e. they can vanish from view at first sync.

## Decisions (made — implement as specified)

Full operational-transform or per-item merging is out of scope. The strategy is:
**document-level LWW with explicit conflict resolution and a merge for the items array**.

### Phase 1 — add a `modifiedAt` timestamp (prerequisite for any LWW)

- Add `modifiedAt?: string` (full ISO) to `Checklist` in `types.ts`; set it to
  `new Date().toISOString()` inside `upsertChecklist` (single choke point — every write goes
  through it) right before `checklistToDoc(c)`.
- Add `modifiedAt: doc.modifiedAt` to `docToChecklist` in `lib/couchdb.ts` (**mandatory** — that
  function drops unlisted fields).

### Phase 2 — resolve replication conflicts

In `useSyncManager.ts`:

- Add a `resolveConflicts(id: string)` function: `localDB.get(id, { conflicts: true })`; if
  `_conflicts` is non-empty, fetch each conflicting rev (`localDB.get(id, { rev })`), choose the
  revision with the **newest `modifiedAt`** (missing `modifiedAt` = oldest), then:
  1. For the items array, merge instead of discard: union of items by item `id` — winner's version
    of any item present in both; items existing only in the loser are appended at the end of the
    winner's top-level array (flattened placement is acceptable; losing a whole task is not).
    Implement as a small pure function `mergeChecklistDocs(winner, loser)` in `lib/couchdb.ts` so
    it can be unit-tested later.
  2. Put the merged winner, then delete every losing rev via
    `localDB.remove(id, losingRev)`.
- Call `resolveConflicts(change.id)` from the changes-feed `on('change')` handler whenever a
  change arrives (cheap: the extra `get` happens only on incoming changes), and once for every doc
  after `loadLocal()`.

### Phase 3 — fix the 409 retry to merge instead of clobber

In `upsertChecklist`'s 409 branch: after fetching `existing`, if `existing.modifiedAt` is **newer**
than the in-memory doc's previous `modifiedAt`, run the same `mergeChecklistDocs` (our doc as
winner — the user's just-made edit wins field-level) before putting. This keeps the common case
(own stale rev cache) identical and stops the cross-device clobber.

### Phase 4 — fix the standalone-checklist collision

In `ensureStandaloneChecklist`: keep the local creation (offline-first requires it), but the Phase 2
conflict resolver now handles the collision — its item-merge by id guarantees pre-login tasks
survive. Additionally, make first-sync ordering friendlier: in `App.vue` the call order
`loadLocal() → ensureStandaloneChecklist()` stays, but add a comment explaining the conflict path
so nobody "optimizes" it away. No code change beyond the comment if Phases 1–3 are done.

## Guardrails — read before editing

- Ship phases in order; each must leave `npm run build` green and the app functional.
- `revCache` must be updated after every put/remove you add, mirroring existing code.
- Never delete the winning rev; only `_conflicts` members.
- `mergeChecklistDocs` must be **pure** (no store access) and must preserve group structure of the
  winner; losing-side items not found anywhere in the winner tree are appended to the top-level
  `items` array (use a tree-walk to collect item ids — reuse `walkNodes` semantics, but note
  `lib/couchdb.ts` cannot import from `composables/` without creating a cycle; if needed, move
  `walkNodes`-style traversal into a tiny local helper).
- Conflict resolution runs on the changes feed — guard against infinite loops: resolving writes a
  new rev which re-triggers the feed; the second pass must find `_conflicts` empty and return
  without writing. Verify this termination property explicitly.
- Do not enable PouchDB's `retry: true` or change the back-off machinery — out of scope.
- The existing rollback path (`rollbackToPersistedState`) and `writeError` banner stay as-is.
- Related but separate: `docs/architecture-review.md` L1 (cascade template delete is local-only and
  can resurrect runs). If trivial after Phase 2, note it in the PR; otherwise leave it.

## Acceptance criteria

- Two browser profiles (or one normal + one private window) synced to the same CouchDB: take both
  offline (devtools), edit *different items* of the same checklist in each, reconnect both → both
  edits survive.
- Same setup, edit the *same item's* text in both → the later edit (by `modifiedAt`) wins; no
  conflict revisions remain (`GET doc?conflicts=true` shows none).
- New empty browser profile: add standalone tasks before logging in, then log in → pre-login tasks
  and the remote standalone tasks all visible after sync.
- `cd src/get-it-done && npm run build` passes with zero errors.
