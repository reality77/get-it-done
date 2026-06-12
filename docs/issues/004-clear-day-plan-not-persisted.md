# 004 — "Clear" day plan mutates state but never persists it

| | |
|---|---|
| **Type** | Bug |
| **Severity** | Medium (silent data divergence between UI and storage) |
| **Confidence** | Certain |
| **Effort** | Small |
| **Files** | `src/get-it-done/src/composables/useDayPlanning.ts` |

## Problem

`clearDayPlan()` in `useDayPlanning.ts` flips `selectedForToday` to `false` in memory but — unlike
every sibling mutation in the same file — never calls `upsertChecklist`:

```ts
function clearDayPlan(): void {
  for (const k in dismissedUntil) delete dismissedUntil[k]
  for (const cl of checklists.value) {
    if (cl.trackMode === 'items') {
      walkNodes(cl.items, n => {
        if (n.type === 'item' && n.selectedForToday) n.selectedForToday = false
      })
    } else if (cl.trackMode === 'checklist' && cl.selectedForToday) {
      cl.selectedForToday = false
    }
  }
}
```

Compare `setDayPlan(...)` directly below it, which tracks a `changed` flag per checklist and calls
`void upsertChecklist(cl)` for each changed one.

User-visible effect: pressing **Clear** in the Day view's `DayPlanBar` empties the plan on screen,
but after a page reload (or on any other synced device) all the cleared selections come back.

The same function has a second, related gap: `refreshDayPlanIfStale()` (same file) also flips
`selectedForToday` without persisting — but note that one runs at app startup against
freshly-loaded data and **is then never persisted either**, so a stale plan is re-cleared on every
launch and other devices never learn about the reset. Fix both the same way.

## Fix

1. In `clearDayPlan()`, mirror the `setDayPlan` pattern: track whether each checklist actually
   changed, and call `void upsertChecklist(cl)` for each changed checklist. Skip archived checklists
   and templates the same way `setDayPlan` does (`if (cl.archived || cl.kind === 'template') continue`)
   — clearing flags inside archived docs is wasted writes.
2. In `refreshDayPlanIfStale()`, add the same per-checklist `changed` tracking and
   `void upsertChecklist(cl)` call. The existing `planMeta.dayPlanDate = null` +
   `planMetaStore.persistPlanMeta()` lines must stay exactly as they are.
3. Use `refreshWeekPlanIfStale()` (same file) as the reference implementation — it already does this
   correctly with a `changed` flag per checklist.

## Guardrails — read before editing

- `upsertChecklist` is available in this scope as the second constructor argument of
  `useDayPlanning(checklists, upsertChecklist)` — call it directly, do not import anything.
- Call it as `void upsertChecklist(cl)` (fire-and-forget), matching the file's existing style.
- Do **not** persist checklists that didn't change — that creates needless PouchDB revisions and
  sync traffic (see issue 014).
- Do **not** touch the `dismissedUntil` wipe at the top of `clearDayPlan` — session-only dismissal
  is intentional product behavior (documented as "will not implement" in
  `docs/architecture-review.md` §M3).
- Do **not** set `planMeta.dayPlanDate` in `clearDayPlan` — clearing a plan is not the same as
  planning a day; leave `planMeta` logic untouched there.

## Acceptance criteria

- Plan a few tasks for today (via Suggest or week-view swipe), press **Clear**, reload the page:
  the Today view stays empty.
- `cd src/get-it-done && npm run build` passes with zero errors.
