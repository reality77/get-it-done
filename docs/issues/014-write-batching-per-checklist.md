# 014 — Single user actions issue multiple racing PouchDB puts on the same document

| | |
|---|---|
| **Type** | Architecture (write amplification / self-inflicted conflicts) |
| **Severity** | Medium (correctness currently rescued by 409-retry; fragile and noisy) |
| **Confidence** | High |
| **Effort** | Medium |
| **Files** | `src/get-it-done/src/composables/useSyncManager.ts` (primary; call sites unchanged) |

## Problem

Store mutations each fire their own `void upsertChecklist(cl)`. Several user flows call multiple
mutations on the **same checklist** synchronously:

- `MobilePlanningSheet.confirm()` can call up to 7 store actions in a row (priority, effort,
  text, deadline, reminders, comment, url) — up to 7 puts of the same doc.
- `StandaloneTaskFab.submit()` → `addItem` + `setItemPriority` + `setItemEffort` + one scheduling
  action (`toggleItemDayPlan` / `snoozeItem` / `sendItemToSomeday`) — up to 4 puts (all on the
  standalone checklist doc).
- `BacklogView.addToWeek()` → `activateItem` + `toggleItemWeekPlan` — 2 puts (the second call goes
  away if issue 012 lands; the pattern concern stands regardless).

All these calls read `revCache.get(c.id)` synchronously before any of the puts resolve, so every
put after the first carries a **stale rev** → guaranteed 409 → retry path refetches and re-puts.
It converges (the doc object is shared and mutated in place, so the last write contains all
changes), but:

- every multi-field edit produces a burst of conflict-retry round trips and extra revisions
  (sync traffic, revision-tree growth);
- correctness depends on the subtle fact that `checklistToDoc` spreads the live object — easy to
  break in refactors;
- it multiplies the cross-device clobber window described in issue 013-A.

There is a second-order effect: each local put echoes through the changes feed
(`subscribeChanges`), which **replaces** `checklists.value[idx]` with a freshly built object on
every burst write — extra reactivity churn for every open component.

## Fix — serialize and coalesce writes per checklist id, inside `useSyncManager`

Implement entirely within `useSyncManager.ts` so no call site changes:

1. Rename the current `upsertChecklist` body to a private `putChecklist(c: Checklist)`.
2. New `upsertChecklist(c)` becomes a **per-id coalescing queue**:

```ts
const pendingWrite = new Map<string, { checklist: Checklist; promise: Promise<void>; queued: boolean }>()

async function upsertChecklist(c: Checklist): Promise<void> {
  const entry = pendingWrite.get(c.id)
  if (entry) {
    // A write for this doc is in flight: remember the latest object and mark a follow-up.
    entry.checklist = c
    entry.queued = true
    return entry.promise
  }
  const newEntry = { checklist: c, queued: false, promise: Promise.resolve() }
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
```

Semantics: at most one put in flight per doc; any number of mutations arriving meanwhile collapse
into exactly one trailing put (which serializes against the in-flight one, so its rev cache read
happens **after** the previous put updated it — no more self-409s).

3. Do **not** add a time-based debounce. Mutations must still hit disk promptly (offline-first app;
   a closed tab must not lose the last keystroke). The queue above adds no delay — it only removes
   concurrency.

## Guardrails — read before editing

- The public signature `upsertChecklist(c: Checklist): Promise<void>` must not change; it is handed
  to `useDayPlanning` as a constructor argument and called ~30 times across the codebase.
- Keep the existing 409-retry inside `putChecklist` — it still covers genuinely external conflicts
  (changes pulled from remote between our writes).
- Keep `writeError` / `rollbackToPersistedState` behavior attached to the actual put, exactly as
  now.
- Mind the in-place-mutation model: callers mutate one shared `Checklist` object and then call
  upsert. Storing `entry.checklist = c` is therefore usually the *same reference*; the queue must
  work whether or not it is (the changes feed can have replaced the array element with a new
  object between calls — always put the **latest** reference passed in).
- `removeFromLocal` (deletes) is rare and id-disjoint from upserts in practice; you may leave it
  outside the queue, but add a one-line comment saying so.
- Do not refactor `MobilePlanningSheet.confirm()` to batch at the UI layer — fixing it centrally
  covers all present and future call sites.
- This issue intersects 013 (Phase 3 modifies `putChecklist`'s 409 branch). If 013 already landed,
  rebase on it: the queue wraps whatever `putChecklist` does.

## Acceptance criteria

- In devtools, open the mobile planning sheet, change priority + effort + text + deadline at once,
  press OK: the Network/IndexedDB activity shows **one or two** puts for the doc (initial +
  coalesced trailing), and no 409 retry loop. (Instrument temporarily with a `console.debug` in
  `putChecklist` if needed; remove it before finishing.)
- Rapidly toggling a task's day-plan state 10× leaves the doc in the final state after reload.
- `cd src/get-it-done && npm run build` passes with zero errors.
