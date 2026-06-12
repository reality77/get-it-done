# 002 — Rename / comment / URL on checklist-level tasks silently do nothing

> **Re-verified 2026-06-10 against `main` @ `dcffd89`.** The original Part C of this issue (hide
> "Delete task" for checklist-tasks in the planning sheet) was fixed independently by PR #71
> (`18d0030`, MobilePlanningSheet redesign): the sheet now takes an `isChecklistTask` prop and
> hides the delete button. The store-level gaps below remain.

| | |
|---|---|
| **Type** | Bug (silent no-op on user actions) |
| **Severity** | High |
| **Confidence** | Certain |
| **Effort** | Medium |
| **Files** | `src/get-it-done/src/stores/checklists.ts`, `src/get-it-done/src/lib/couchdb.ts`, `src/get-it-done/src/types.ts`, `src/get-it-done/src/composables/useDayPlanning.ts` |

## Background you must understand first

A checklist can be tracked in mode `'checklist'` (`trackMode: 'checklist'`), meaning the **whole
checklist is one task**. In task views it appears as a *synthetic* `ChecklistItem` built in
`collectTrackedItems()` (`useDayPlanning.ts`) whose `id` equals the **checklist's id**:

```ts
const syntheticItem: ChecklistItem = { type: 'item', id: cl.id, text: title, ... }
```

So for these tasks, every `ChecklistItemId` ref has `itemId === checklistId`. Store functions that
look the item up in the tree (`findItemDeep(checklist.items, itemId)`) will never find it — the
synthetic item is not in the tree.

Two store functions already special-case this correctly (added in commit `52bbb4b`). This is the
exact pattern to replicate:

```ts
function setItemDeadline({ checklistId, itemId }: ChecklistItemId, deadline: string | null): void {
  const checklist = getChecklist(checklistId)
  if (!checklist) return
  if (checklist.trackMode === 'checklist' && itemId === checklistId) {
    checklist.deadline = deadline
    void sync.upsertChecklist(checklist)
    return
  }
  const item = findItemDeep(checklist.items, itemId)
  ...
}
```

## Problem

Three store functions in `stores/checklists.ts` **lack** that branch, so for checklist-tasks they
silently fall through `findItemDeep → undefined → return`:

1. `updateItemText` — called by `TaskCard.vue` (double-click title edit) and by
   `MobilePlanningSheet.vue` `confirm()`. **Renaming a checklist-task silently fails.**
2. `updateItemComment` — called by `MobilePlanningSheet.confirm()`. Comment typed → silently lost.
3. `updateItemUrl` — same.

Additionally `removeItem` is a silent no-op for checklist-tasks (`removeNodeDeep` finds nothing).
The UI no longer offers delete for them (PR #71), but the store API remains a trap.

## Fix — three parts

### Part A: route title edits to the checklist

In `updateItemText`, add the checklist-task branch. Display titles come from
`cl.runLabel ?? cl.title` (see `collectTrackedItems`), so write to the field the user is actually
seeing:

```ts
if (checklist.trackMode === 'checklist' && itemId === checklistId) {
  if (checklist.runLabel != null) checklist.runLabel = text
  else checklist.title = text
  void sync.upsertChecklist(checklist)
  return
}
```

### Part B: add checklist-level `comment` and `url`

The `Checklist` interface has no comment/url, so there is nowhere to store them. Follow the exact
precedent of `deadline`/`reminders` (which were added for checklist-tasks in `52bbb4b`):

1. `types.ts` — add to the `Checklist` interface, in the "Task fields for trackMode='checklist'"
   block: `comment?: string` and `url?: string`.
2. `lib/couchdb.ts` `docToChecklist()` — add `comment: doc.comment, url: doc.url,` to the returned
   object. **This step is mandatory**: `docToChecklist` rebuilds the object field-by-field and any
   field missing there is silently dropped on every reload/sync. (`checklistToDoc` uses a spread
   and needs no change.)
3. `useDayPlanning.ts` `collectTrackedItems()` — add `comment: cl.comment, url: cl.url,` to the
   `syntheticItem` literal so the fields round-trip into the UI. Also add them to the synthetic
   item built in the `archivedTodayItems` computed in the same file (search for the second
   `isChecklistTask: true` literal).
4. `stores/checklists.ts` — add the checklist-task branch to `updateItemComment` and
   `updateItemUrl`, writing `checklist.comment = comment || undefined` /
   `checklist.url = url || undefined` (mirror the empty-string-to-undefined behavior of the item
   versions).
5. `stores/checklists.ts` `_clearChecklistTaskFields()` — do **not** add comment/url to the cleared
   fields. Deadline/reminders are cleared there because they drive scheduling; a user's note should
   survive a tracking-mode switch. Leave that function untouched.

### Part C: defensive store guard for delete

In `removeItem` in `stores/checklists.ts`, add an early guard so the API can never half-apply:

```ts
if (checklist.trackMode === 'checklist' && itemId === checklistId) return
```

(Plain `return`, no error — the UI already prevents the call; the guard is belt-and-braces.)

## Guardrails — read before editing

- **Do not** make `removeItem` delete the whole checklist for checklist-tasks. Deleting a checklist
  is a destructive, separate operation (`deleteChecklist`) with its own UI; a task-level API must
  not gain that power silently.
- **Do not** modify `setItemDeadline` / `setItemReminders` — they already work.
- **Do not** change the `ChecklistItemId` type or the synthetic-id convention
  (`itemId === checklistId`); large parts of `useDayPlanning.ts` rely on it
  (`isChecklistTaskRef`, `toggleItemDayPlan`, `toggleItemWeekPlan`).
- **Do not** redesign `MobilePlanningSheet.vue` — PR #71 already gave it Details/Actions tabs and
  the `isChecklistTask` prop. After Parts A/B its existing `confirm()` calls become correct for
  checklist-tasks with **zero changes to the sheet**.
- In `TaskCard.vue` the title editor calls `store.updateItemText` for all cards — after Part A this
  becomes correct for checklist-tasks too; **no TaskCard change is needed**.
- `migrateNodes` in `useTreeHelpers.ts` handles **item** nodes only and already copies item-level
  `comment`/`url`; it needs **no change** for checklist-level fields.
- Mind issue 014: each store call still does its own `upsertChecklist`; do not try to batch writes
  here — out of scope.

## Acceptance criteria

- Track a checklist in "Track Checklist" mode. In Today/Week/Backlog:
  - Double-click its card title → edit → the new name persists after reload.
  - Open the card's planning sheet (long-press on mobile, hover ⋯ button on desktop), set a
    comment and a URL on the Details tab, press OK → icons appear on the card; both survive a
    reload.
  - The sheet's Actions tab still shows no "Delete task" for that card (unchanged from #71);
    regular item tasks still show it and it still works.
- A run instance (`runLabel != null`) tracked as checklist renames its **runLabel** (the displayed
  string changes).
- `cd src/get-it-done && npm run build` passes with zero errors.
