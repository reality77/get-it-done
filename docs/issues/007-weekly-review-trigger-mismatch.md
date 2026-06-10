# 007 — Weekly review triggers on the wrong snooze condition

| | |
|---|---|
| **Type** | Bug / docs-behavior mismatch |
| **Severity** | Low (review banner fires on near-dead condition; documented trigger never fires) |
| **Confidence** | High |
| **Effort** | Small |
| **Files** | `src/get-it-done/src/composables/useDayPlanning.ts` |

## Problem

Documented behavior (`CLAUDE.md` → Key Features): *"Weekly review: triggers on Mondays, stale
snoozes (14+ days), or 7+ days since last review."*

Actual code in `useDayPlanning.ts`:

```ts
const weeklyReviewDue = computed((): boolean => {
  const today = new Date()
  const isMonday = today.getDay() === 1
  const hasDueSnoozed = dueSnoozedItems.value.length > 0
  ...
  return (isMonday && !reviewedThisWeek) || hasDueSnoozed || overdueReview
})
```

It uses `dueSnoozedItems` (snoozeUntil ≤ today) — **not** `staleSnoozedItems` (snoozed 14+ days ago,
which exists in the same file and is exported but consumed by nothing).

Why `dueSnoozedItems` is a near-dead trigger: `processDueSnoozed()` runs at every app mount
(`App.vue` `onMounted`) and converts all due snoozes back to `active`, clearing `snoozeUntil`. So
`dueSnoozedItems` is non-empty only if the app stays open across a snooze date boundary. Meanwhile
the documented "stale snoozes (14+ days)" trigger — the one that surfaces forgotten tasks — never
fires the review.

There is a second, smaller mismatch: `overdueReview` is true when `lastReviewedAt` is `null`, so a
brand-new install shows the Weekly Review banner immediately, before the user has any tracked tasks.

## Fix

In the `weeklyReviewDue` computed:

1. Replace `const hasDueSnoozed = dueSnoozedItems.value.length > 0` with
   `const hasStaleSnoozed = staleSnoozedItems.value.length > 0` and use it in the return expression.
2. Gate the whole computed on having anything to review: prepend
   `if (trackedItems.value.length === 0) return false`. (Both `staleSnoozedItems` and
   `trackedItems` are computeds defined earlier in the same composable — reference them with
   `.value`.)
3. Leave `dueSnoozedItems` itself in place (still exported; `processDueSnoozed` logic is unrelated
   and must not change).

## Guardrails — read before editing

- **Do not** delete or modify `dueSnoozedItems` or `processDueSnoozed`. Due-snooze auto-activation
  at startup is correct, intended behavior.
- **Do not** change `staleSnoozedItems`'s 14-day constant (`STALE_SNOOZE_DAYS` in
  `config/constants.ts`).
- **Do not** touch `suggestWeekPlan()` — it intentionally lists *snoozed* items for the review
  panel and is a separate concern.
- `WeeklyReviewPanel.vue` and `App.vue` consume `weeklyReviewDue` as an opaque boolean; they need
  no changes.
- Mind issue 006: `getMondayDateString()` may be edited concurrently for timezone reasons; that
  does not affect this change.

## Acceptance criteria

- Fresh state (no checklists/tasks): no Weekly Review banner.
- A task snoozed with `snoozedAt` ≥ 14 days in the past (fabricate by temporarily lowering
  `STALE_SNOOZE_DAYS` in `config/constants.ts`, then restore it) makes the banner appear even on a
  non-Monday with a recent review — `hasStaleSnoozed` is an independent OR-term.
- Monday + not yet reviewed this week still triggers; 7+ days since last review still triggers.
- `cd src/get-it-done && npm run build` passes with zero errors.
