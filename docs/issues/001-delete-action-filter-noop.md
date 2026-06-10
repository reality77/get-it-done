# 001 — Delete-action filter compares the wrong field and never matches

| | |
|---|---|
| **Type** | Bug |
| **Severity** | High (broken UI affordance, silent no-op button shown to users) |
| **Confidence** | Certain — verified by reading both sides of the comparison |
| **Effort** | Small |
| **Files** | `src/get-it-done/src/composables/useTaskActions.ts`, `src/get-it-done/src/components/organisms/DayView.vue`, `src/get-it-done/src/components/organisms/WeekView.vue`, `src/get-it-done/src/components/organisms/BacklogView.vue` |

## Problem

Action buttons for task cards are built by two factories in
`src/get-it-done/src/composables/useTaskActions.ts`. The delete action they produce is:

```ts
{ label: '✕', title: 'Delete', variant: 'danger', onClick: () => onDelete(id) }
```

Note: **`label` is `'✕'`** (the glyph shown on the button) and **`title` is `'Delete'`** (the tooltip).

Three views try to remove the delete button for checklist-level tasks ("checklist tasks" =
`TrackedItemRef.isChecklistTask === true`, where the whole checklist is one task) by filtering on
`label`:

`DayView.vue` (inside `dayActions`):
```ts
return makeSnoozeSomedayDeleteActions(
  taskRef,
  (id, date) => store.snoozeItem(id, date),
  (id) => store.sendItemToSomeday(id),
  () => { /* checklist tasks not individually removable */ },
).filter(a => a.label !== 'Delete')
```

`WeekView.vue` (inside `weekActions`) — identical pattern, and
`BacklogView.vue` (inside `backlogActions`):
```ts
if (taskRef.isChecklistTask) return actions.filter(a => a.label !== 'Delete')
```

Since no action ever has `label === 'Delete'`, the filter removes nothing. Result: checklist tasks
show a red ✕ delete button that does nothing when clicked (DayView/WeekView pass a no-op callback;
BacklogView passes `store.removeItem`, which is itself a silent no-op for checklist tasks — see
issue 002).

## Fix

Make "no delete" an explicit capability of the factories instead of post-filtering by display text.
In `useTaskActions.ts`:

1. Change `makeSnoozeSomedayDeleteActions` so the `onDelete` parameter type is
   `((id: ChecklistItemId) => void) | null`, and only push the delete action when `onDelete` is not
   `null`.
2. Change `makeStatusActions` the same way: make `onDelete` in its `options` object nullable and
   skip the delete button when `null`.
3. Update the three views:
   - `DayView.vue` `dayActions`: for the `isChecklistTask` branch pass `null` as `onDelete` and
     delete the `.filter(...)` call and the no-op arrow function.
   - `WeekView.vue` `weekActions`: same.
   - `BacklogView.vue` `backlogActions`: pass `onDelete: taskRef.isChecklistTask ? null : (id) => store.removeItem(id)`
     and delete the `.filter(...)` line.
4. `WeeklyReviewPanel.vue` also calls `makeStatusActions` — it always passes a real `onDelete`;
   its call site needs **no behavioral change**, only confirm it still type-checks.

## Guardrails — read before editing

- Do **not** "fix" this by changing the filter to `a.title !== 'Delete'`. It would work today but
  keeps the fragile match-by-display-string pattern that caused this bug.
- Do **not** change the `label`/`title` values of the actions ( `'💤'`, `'☁'`, `'✕'` etc.) — other
  components key off them (`TaskCardActions.vue` uses `action.label` as a `:key` and for snooze-menu
  open state).
- Do **not** remove the delete action for *regular* (non-checklist-task) items — it must keep working
  in all three views and in `WeeklyReviewPanel`.
- `ButtonActionDef` in `src/get-it-done/src/types.ts` does not need to change.

## Acceptance criteria

- For a checklist tracked with `trackMode: 'checklist'` (create a checklist → click its `○ Track`
  button → choose "Track Checklist"), the task card in Today / Week / Backlog shows **no** ✕ button,
  on desktop hover and in the mobile ⋯ sheet fallback.
- Regular item tasks still show ✕ and clicking it removes the item.
- `cd src/get-it-done && npm run build` passes with zero errors.
