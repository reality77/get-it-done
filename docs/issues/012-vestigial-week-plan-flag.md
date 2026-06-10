# 012 — `selectedForWeek` is written by three UIs but read by nothing

> **Re-verified 2026-06-10 against `main` @ `dcffd89`.** Still valid and slightly worse: PR #70
> added a **third writer** — the add-task FAB's "This week" scheduling option — so the misconception
> is now baked into the creation flow too.

| | |
|---|---|
| **Type** | Design issue / misconception trap |
| **Severity** | Medium (misleading UX labels; dead state machinery invites wrong "fixes") |
| **Confidence** | High |
| **Effort** | Medium |
| **Files** | `src/get-it-done/src/composables/useDayPlanning.ts`, `BacklogView.vue`, `WeeklyReviewPanel.vue`, `StandaloneTaskFab.vue`, `stores/checklists.ts`, `App.vue` |

## History — read this so you don't re-fight a settled battle

Git history shows deliberate churn on week-view semantics:

- `0c919a2` (#51): week view scoped to `selectedForWeek` items.
- `f60e156` (#52): **"fix: week view shows all active tasks"** — scoping reverted.
- `f0f39ad` (#50): reverted two other week-planning PRs "to restore pre-change week planning
  behavior".

The settled product behavior is: **the Week tab shows ALL active tracked tasks**, sorted by
deadline/priority. That is what `WeekView.vue` does today (it consumes `itemsByPriority`, not
`weekPlanItems`). Do not change that.

## Problem

The `selectedForWeek` machinery survived the reverts and is now write-only:

- **Writers:**
  - `BacklogView` swipe "Add to week" → `activateItem` + `toggleItemWeekPlan`;
  - `WeeklyReviewPanel` swipe "Add to week" → same pair;
  - `StandaloneTaskFab` (PR #70): scheduling option "This week" → `store.toggleItemWeekPlan(ref)`.
- **Readers:** none. `weekPlanItems` (computed) is exported by the store and consumed by **no
  component**. No view renders a "WEEK" badge or filters on the flag.
- **Lifecycle:** `refreshWeekPlanIfStale()` runs at every app start solely to clear flags nobody
  reads; `planMeta.weekPlanDate` exists solely to support that.

Consequences:
1. The "Add to week" / "This week" labels lie. What those actions actually do is **activate** the
   task (or, for the FAB, nothing at all — a newly created task is already active), which makes it
   appear in the Week tab because that tab shows all active tasks. And being a *toggle*, a second
   "Add to week" on the same task silently flips the invisible flag back off.
2. Future agents/devs discover `weekPlanItems` and "helpfully" wire WeekView to it — re-breaking
   the behavior that #50/#52 fixed. (This nearly qualifies as a misconception generator.)

## Fix (minimal, preserves settled behavior)

1. **Relabel the actions to what they do.** In `BacklogView.vue` and `WeeklyReviewPanel.vue`,
   change the swipe hint `'Add to week'` to `'↩ Activate'`, and remove the
   `store.toggleItemWeekPlan(id)` call from `addToWeek` / `reviewSwipeLeft` (keep
   `store.activateItem(id)` and, in the review panel, the `dismissFromPanel` call).
2. **FAB:** in `StandaloneTaskFab.vue`'s `submit()`, the `case 'week':` branch becomes an empty
   `break` with a comment (`// new items are active by default — visible in the Week tab`). Keep
   the "This week" option in the UI: as a *scheduling choice* it is honest ("not today, not
   snoozed, just this week's pool"), it simply requires no store call.
3. **Remove the dead store machinery:** in `useDayPlanning.ts`, delete `weekPlanItems`,
   `toggleItemWeekPlan`, and `refreshWeekPlanIfStale`; in `stores/checklists.ts`, remove their
   re-exports; in `App.vue`, remove the `checklistStore.refreshWeekPlanIfStale()` call.
   `suggestWeekPlan` stays — `WeeklyReviewPanel` uses it.
4. **Keep the data fields.** `selectedForWeek` remains in `types.ts`, `migrateNodes`,
   `docToChecklist`/synthetic items, and `_clearItemTaskFields`/`_clearChecklistTaskFields` —
   existing CouchDB documents contain the field and stripping it from types would orphan real data
   and break `enableChecklistTracking`'s field handling. Leave `PlanMeta.weekPlanDate` in the type
   too (it's optional); just stop writing it.

## Alternative (requires explicit user request — do NOT do by default)

Finish the feature instead: render a "WEEK" ribbon in WeekView for `selectedForWeek` items (like
the existing lime "TODAY" ribbon) and a filter toggle "All / This week". Only do this if the user
asks for it; the git history says the team chose "show all active".

## Guardrails — read before editing

- **Do not** filter `WeekView` by `selectedForWeek`. This exact change was made and reverted twice.
- **Do not** remove `selectedForWeek` from persisted-data handling (`types.ts`, `migrateNodes`,
  `docToChecklist`) — only remove the *behavioral* machinery listed above.
- **Do not** remove the "This week" option from the FAB's scheduling row, and do not touch its
  other cases (`today` → `toggleItemDayPlan`, `next-week` → snooze, `someday`) — they are real.
- `enableChecklistTracking` initializes `cl.selectedForWeek` — you may leave that line; it's
  harmless field initialization on live data. Do not refactor tracking functions here.
- `useDayPlanning.ts` also contains a module-level `PRIORITY_ORDER` used by the `snoozedItems`
  sort (PR #65) — that is unrelated; don't remove it.
- TypeScript `noUnusedLocals` will flag anything you orphan — let the compiler guide the cleanup
  (`cd src/get-it-done && npm run build`).

## Acceptance criteria

- Backlog: swiping a snoozed/someday task right shows "↩ Activate"; the task appears in Week
  (because it's active) and leaves the backlog list.
- Weekly review panel swipe-left activates and dismisses the card from the panel.
- FAB → "This week" creates an active task that shows in the Week tab and not in Today.
- `grep -rn "toggleItemWeekPlan\|weekPlanItems\|refreshWeekPlanIfStale" src/get-it-done/src` →
  zero matches.
- `cd src/get-it-done && npm run build` passes with zero errors.
