# 008 — Push server never sees checklist-level tasks; notifies for done/archived items

| | |
|---|---|
| **Type** | Bug |
| **Severity** | Medium (silently missing notifications; spurious notifications) |
| **Confidence** | High |
| **Effort** | Medium |
| **Files** | `src/push-server/src/couch.ts` (only) |

## Background you must understand first

The Vue app stores task scheduling data in two places inside each CouchDB document of the
`get-it-done` database:

1. **Item level** (`trackMode: 'items'`): each node in the recursive `items` tree may carry
   `status`, `snoozeUntil`, `reminders: string[]`, `done`.
2. **Document (checklist) level** (`trackMode: 'checklist'`): the *whole checklist is one task* and
   the same fields live on the **document root**: `doc.status`, `doc.snoozeUntil`, `doc.reminders`.
   This was added in app commit `6d66add`/`52bbb4b` — after the push server was written.

Documents also carry `archived: boolean` and `kind: 'one-time' | 'template' | 'run'`.

## Problems in `src/push-server/src/couch.ts`

1. `findDueSnoozedItems(today)` and `findDueTaskReminders(...)` only walk `doc.items`. Snoozes and
   reminders set on a `trackMode: 'checklist'` task (document root) **never produce a push**.
2. Neither scanner skips `archived` documents or `kind === 'template'` documents. A snoozed item
   inside an archived checklist (or a template) still produces a "Snooze ended" push.
3. `findDueTaskReminders` ignores `done`: a reminder set on a task the user already completed still
   fires "⏰ Reminder".

## Fix — all inside `couch.ts`

### 1. Extend the local interfaces

```ts
interface ChecklistItem {
  type: 'item'
  id: string
  text: string
  done?: boolean                       // ← add
  status?: 'active' | 'snoozed' | 'someday'
  snoozeUntil?: string | null
  reminders?: string[]
}

interface ChecklistDoc {
  _id: string
  title?: string                       // ← add
  runLabel?: string | null             // ← add
  kind?: string                        // ← add
  archived?: boolean                   // ← add
  trackMode?: string                   // ← add
  status?: 'active' | 'snoozed' | 'someday'   // ← add (doc-level task fields)
  snoozeUntil?: string | null          // ← add
  reminders?: string[]                 // ← add
  done?: never                         // (do NOT add done at doc level; archived plays that role)
  items?: ChecklistNode[]
}
```

(Keep these as *local* structural types — the push server intentionally does not import the app's
`types.ts`; the two packages have separate builds.)

### 2. `findDueSnoozedItems`

For each row:
- `if (!doc || doc.archived || doc.kind === 'template') continue`
- Keep the existing item-level walk (unchanged condition).
- Add the doc-level check:
  ```ts
  if (doc.trackMode === 'checklist' && doc.status === 'snoozed'
      && doc.snoozeUntil && doc.snoozeUntil <= today) {
    due.push({ text: doc.runLabel ?? doc.title ?? 'Checklist' })
  }
  ```
- When `trackMode === 'checklist'`, do **not** also walk `doc.items` for snoozes — in that mode
  item-level task fields are cleared by the app and any leftovers are stale.

### 3. `findDueTaskReminders`

- Same archived/template skip at the top of the loop.
- Item-level loop: add `if (item.done) continue` before checking `item.reminders`.
- Add a doc-level pass mirroring the item logic:
  ```ts
  if (doc.trackMode === 'checklist' && doc.reminders?.length) {
    for (const reminderAt of doc.reminders) {
      const t = new Date(reminderAt)
      if (t >= windowStart && t < windowEnd) {
        due.push({ checklistId, itemId: checklistId, text: doc.runLabel ?? doc.title ?? 'Checklist', reminderAt })
      }
    }
  }
  ```
  Using `itemId = checklistId` matches the app's synthetic-id convention and keeps the
  fired-reminder dedup key (`firedId(checklistId, itemId, reminderAt)`) stable and unique.

## Guardrails — read before editing

- This issue is **server-only**. Do not modify anything under `src/get-it-done/`.
- Do not change `subId`, `firedId`, or the `push_fired_reminders` scheme — existing fired-marker
  docs must keep deduplicating.
- Do not switch `_all_docs` to a Mango query/view in this issue (perf is a non-goal here; the
  dataset is tiny).
- `snoozeUntil <= today` string comparison is correct for `YYYY-MM-DD` strings — keep it.
- The scheduler timezone problems (server-local `todayDate()`, 60-s window) are issue **009** — do
  not fix them here even though you will see them in `scheduler.ts`.
- Build/verify with `cd src/push-server && npm run build` (plain `tsc`).

## Acceptance criteria

- A `trackMode: 'checklist'` document with `status: 'snoozed'`, `snoozeUntil` ≤ today is returned by
  `findDueSnoozedItems`; the same doc with `archived: true` is not.
- A doc-level `reminders` entry inside the window is returned by `findDueTaskReminders` with
  `itemId === checklistId`.
- An item with `done: true` and a due reminder is **not** returned.
- `cd src/push-server && npm run build` passes with zero errors.
