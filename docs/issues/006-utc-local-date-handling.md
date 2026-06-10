# 006 — All "today" date math uses UTC; wrong behavior for any non-UTC user

> **Re-verified 2026-06-10 against `main` @ `dcffd89`.** Still valid. One helpful development:
> PR #67/#68 introduced a **local** `parseLocalDate` helper inside `BacklogView.vue` — it is the
> correct pattern and compiles under this repo's strict settings. The fix below promotes it to the
> shared helper module instead of inventing a new one.

| | |
|---|---|
| **Type** | Bug cluster (correctness, timezone) |
| **Severity** | High for users far from UTC; invisible in UTC |
| **Confidence** | High |
| **Effort** | Medium — mechanical but cross-cutting; follow the checklist exactly |
| **Files** | `useTreeHelpers.ts`, `useDayPlanning.ts`, `useSnoozeOptions.ts`, `WeeklyReviewPanel.vue`, `SnoozeModal.vue`, `TaskCard.vue`, `BacklogView.vue` (all under `src/get-it-done/src/`) |

## Problem

Calendar-day strings (`YYYY-MM-DD`) are produced via `new Date().toISOString().slice(0, 10)`, which
is the **UTC** date — but the user thinks in **local** days. Symptoms for a user at UTC+2 (or worse,
UTC−8):

- The day plan "rolls over" at UTC midnight, not local midnight (`refreshDayPlanIfStale`).
- A task completed at 00:30 local doesn't appear in "Completed today" (its `completedAt` UTC prefix
  is yesterday) — and conversely for negative offsets.
- Snooze presets computed in the evening can land on the wrong calendar day.
- `getMondayDateString()` mixes **local** `getDay()` with **UTC** `toISOString()` — near midnight
  the two disagree and the "Monday of this week" can be off by a day.
- `TaskCard.dateBadge()` and `BacklogView.formatSnoozeDate()` parse date-only strings with
  `new Date('YYYY-MM-DD')` (= UTC midnight) — badges/ribbons shift a day for negative UTC offsets.

## The model to implement

One rule everywhere: **a `YYYY-MM-DD` string in this app always means a LOCAL calendar day.**

Add two helpers in `src/get-it-done/src/composables/useTreeHelpers.ts` (where `todayDateString`
already lives) and reuse them everywhere:

```ts
/** Format a Date as the LOCAL calendar day, YYYY-MM-DD. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a YYYY-MM-DD (or longer ISO) string as LOCAL midnight of that day. */
export function parseLocalDate(dateStr: string): Date {
  const [y = '0', m = '1', d = '1'] = dateStr.slice(0, 10).split('-')
  return new Date(+y, +m - 1, +d)
}
```

`parseLocalDate` uses destructuring defaults on purpose — the base tsconfig enables
`noUncheckedIndexedAccess` (see commit `05f4526`, which fixed exactly this in BacklogView's local
copy). Do not use non-null assertions on array indexing here.

Then change `todayDateString()` to `return toLocalDateString(new Date())`.

## Site-by-site checklist

Work through every entry; each gives the snippet to find and the replacement intent.

### `useTreeHelpers.ts`
- `todayDateString()` — as above; add the two new exported helpers.

### `BacklogView.vue`
- Delete the local `function parseLocalDate(dateStr: string): Date` and import the shared one from
  `'../../composables/useTreeHelpers'` (behavior identical — it was the template for the shared
  helper).
- `formatSnoozeDate(raw)`: `new Date(raw).toLocaleDateString(...)` parses `YYYY-MM-DD` as UTC
  midnight → replace with `parseLocalDate(raw).toLocaleDateString(...)`.

### `useDayPlanning.ts`
- `getMondayDateString()` — after `d.setDate(...)`, replace
  `return d.toISOString().substring(0, 10)` with `return toLocalDateString(d)`.
- `deadlineBonus(...)` — `daysAway` currently mixes `new Date(d)` (UTC midnight) and
  `new Date(today)`. Replace both with `parseLocalDate(...)` so the subtraction is
  local-vs-local: `Math.ceil((parseLocalDate(d).getTime() - parseLocalDate(today).getTime()) / 86_400_000)`.
- `suggestDayPlan()` — `const tomorrow = new Date(new Date(today).getTime() + 86_400_000)...`:
  replace with
  `const t = parseLocalDate(today); t.setDate(t.getDate() + 1); const tomorrow = toLocalDateString(t)`.
  (`setDate` is DST-safe; adding 86_400_000 ms is not.)
- `dayPlanItems` / `archivedTodayItems` — these compare `completedAt?.startsWith(today)` /
  `archivedAt?.startsWith(today)`. `completedAt`/`archivedAt` are full UTC ISO timestamps, so the
  prefix is the UTC day. Replace each `x.startsWith(today)` with a helper comparison:
  `completedToday(x, today)` where
  `const completedToday = (iso: string | null | undefined, today: string) => iso != null && toLocalDateString(new Date(iso)) === today`.
  Put the helper at module level in `useDayPlanning.ts` next to `itemKey`. There are **four** such
  `startsWith(today)` occurrences in the file — fix all of them.

### `useSnoozeOptions.ts`
- `nextMondayDate`, `addMonthsToToday`, and both `subtract*` closures inside
  `getDeadlineSnoozeOptions` — replace every `d.toISOString().slice(0, 10)` with
  `toLocalDateString(d)` (five occurrences).
- `getDeadlineSnoozeOptions` — `const dl = new Date(deadline.slice(0, 10))` parses UTC; replace
  with `parseLocalDate(deadline)`. Also `const todayStr = new Date().toISOString().slice(0, 10)`
  → `todayDateString()`.
- Import the helpers from `useTreeHelpers` (this file currently has no imports — add one).

### `WeeklyReviewPanel.vue`
- In `reviewSwipeRight`, `store.snoozeItem(refToId(taskRef), d.toISOString().slice(0, 10))` →
  `toLocalDateString(d)` (import from `../../composables/useTreeHelpers`).

### `SnoozeModal.vue`
- `const todayStr = new Date().toISOString().slice(0, 10)` → `todayDateString()` (import it).

### `TaskCard.vue`
- `dateBadge(raw)`: replace `const d = new Date(raw); d.setHours(0,0,0,0)` with
  `const d = parseLocalDate(raw)`. (`raw` may be `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`;
  `parseLocalDate` slices to the date part, which is exactly what the day-granularity badge wants.)
  Keep the `today.setHours(0,0,0,0)` line for the local-midnight comparison.

## Explicitly NOT in scope — do not touch

- **`reminders`** (`string[]` of full ISO timestamps) are absolute instants; their `toISOString()`
  round-trips in `MobilePlanningSheet.vue` are **correct**. Do not change reminder handling.
- **`createdAt` / `archivedAt` / `completedAt` / `snoozedAt` storage format** stays full UTC ISO
  (`new Date().toISOString()`). Only their *comparison to calendar days* changes.
- **Stored `snoozeUntil` / `deadline` / `dayPlanDate` values** stay `YYYY-MM-DD` strings. No data
  migration is needed — the interpretation, not the format, changes.
- **`BacklogView.getWeekBoundaries()`** already does pure local-Date arithmetic — correct, leave it.
- **`WeekView.sortedItems`** uses `new Date(deadline).getTime()` only as a sort key — consistent
  within itself; leave it.
- **The push server** (`src/push-server/`) has its own timezone problems — covered by issue 009.
  Don't edit it here.
- String comparisons like `snoozeUntil <= today` are fine once both sides are local-day strings —
  do not rewrite them into Date math.

## Guardrails

- Make the helpers in ONE place (`useTreeHelpers.ts`) and import them. Do not paste private copies
  into each file; delete BacklogView's existing private copy as instructed.
- Use `setDate`/`setMonth` arithmetic, never `+ n * 86_400_000` on timestamps (DST).
- After editing, grep the app source for `toISOString().slice(0, 10)` and
  `toISOString().substring(0, 10)` — there must be **zero** remaining matches under
  `src/get-it-done/src/`.

## Acceptance criteria

- The greps above return nothing, and `grep -rn "function parseLocalDate" src/get-it-done/src`
  matches only `useTreeHelpers.ts`.
- With system TZ set to e.g. `Pacific/Auckland` (UTC+12/13) and to `America/Los_Angeles` (UTC−7/8):
  completing a task shows it under "Completed" today; a deadline set to today shows a red badge
  dated today; snooze "Next week" lands on the local next Monday; the backlog snooze ribbon shows
  the same date the user picked.
- `cd src/get-it-done && npm run build` passes with zero errors.
