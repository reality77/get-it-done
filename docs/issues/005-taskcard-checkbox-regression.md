# 005 — TaskCard completion checkbox was dropped in PR #63 (regression)

> **Re-verified 2026-06-10 against `main` @ `dcffd89`.** Still valid, but the severity picture
> changed: PR #71 added a "✓ Complete task" button to the planning sheet's Actions tab, so Day
> view tasks *can* now be completed on desktop (buried behind hover-⋯ → Actions). Week view's
> "Completion" mode is **still completely inert**. Also note PR #66 reversed TaskCard's click
> model — see the updated fix below (the `@click.stop` requirement changed its reason).

| | |
|---|---|
| **Type** | Bug — regression |
| **Severity** | High (Week "Completion" mode is fully inert; one-tap completion lost everywhere) |
| **Confidence** | Certain — verified against git history |
| **Effort** | Medium |
| **Files** | `src/get-it-done/src/components/molecules/TaskCard.vue` (primary); read-only reference: `DayView.vue`, `WeekView.vue`, `BacklogView.vue` |

## Problem

Commit `29d7b9b` ("feat: task card details (#63)") rewrote `TaskCard.vue` and dropped the
completion checkbox. The props `showCheckbox` and `onChecklistDone` still exist but are now **dead**
— nothing in the template references them.

What the pre-#63 TaskCard did (recovered via `git show 49eaf0b~1 -- ...TaskCard.vue`):

```html
<AppCheckbox
  v-if="showCheckbox !== false"
  :model-value="item.done"
  @update:model-value="isChecklistTask ? onChecklistDone?.() : store.toggleItem({ checklistId, itemId: item.id })"
/>
```

Key semantics to restore:
- Checkbox is shown **by default** (`showCheckbox !== false`); a view must pass
  `:show-checkbox="false"` to hide it (BacklogView does this deliberately — backlog items are
  snoozed/someday and shouldn't be completed from there).
- For checklist-tasks, ticking does **not** toggle anything directly — it calls `onChecklistDone`,
  which the views wire to open `ChecklistCompletionModal` (you complete a checklist by checking off
  its items, then archiving).

Current user-visible breakage (state as of `dcffd89`):
1. **Week view, "Completion" mode:** the mode exists precisely to tick tasks off, but in that mode
   the view passes no actions, no swipe handlers, and no mobile-sheet slot (the slot is
   `v-if="mode === 'planning'"`) — so there is no ⋯ button, no long-press sheet, no checkbox.
   Cards are completely inert; clicking them only toggles the details panel.
2. **Day view:** completing a task takes hover → ⋯ → Actions tab → "✓ Complete task" on desktop,
   or long-press → Actions tab on mobile (swipe also works on touch). The one-tap checkbox is
   gone, including for un-completing items in the "Completed" section.

Also relevant: PR #66 (`51b07f5`) changed the card click model — a plain card click now toggles
the details panel (`handleCardClick` → `displayDetails`), and the sheet opens via long-press
(mobile) or the hover ⋯ button (desktop).

## Fix

Reintroduce the checkbox in `TaskCard.vue` with the original semantics:

1. Import the atom: `import AppCheckbox from '../atoms/AppCheckbox.vue'`.
2. In the title row (the `div.flex.items-start.gap-2` that contains the editable title), insert the
   checkbox as the **first** element, before the title input/span:

   ```html
   <AppCheckbox
     v-if="showCheckbox !== false"
     :model-value="item.done"
     class="mt-0.5 shrink-0"
     @click.stop
     @update:model-value="isChecklistTask ? onChecklistDone?.() : store.toggleItem({ checklistId, itemId: item.id })"
   />
   ```

   The `@click.stop` matters: `VCard` has `@click="handleCardClick"`, which (since PR #66) toggles
   the details panel — ticking the checkbox must not also expand/collapse details. Verify
   `AppCheckbox`'s root element forwards native `click`; if it doesn't, wrap it in a
   `<span @click.stop>` instead. Check `src/get-it-done/src/components/atoms/AppCheckbox.vue` and
   adapt.
3. `store` is already available in TaskCard (`const store = useChecklistStore()`); `isChecklistTask`,
   `showCheckbox`, `onChecklistDone` are existing props. No prop changes needed.
4. Long-press interaction: the checkbox sits inside `rowEl`, which has an `onLongPress` handler.
   A press-and-hold starting on the checkbox would open the sheet — that matches the rest of the
   card and needs no special handling.

No view changes are required: `WeekView` already passes `:show-checkbox="mode === 'completion'"`,
`BacklogView` passes `false`, `DayView` passes nothing (⇒ default visible), and both DayView and
WeekView already pass `:on-checklist-done` for checklist-tasks.

## Guardrails — read before editing

- **Do not** invent a new prop or change defaults: the contract is "visible unless explicitly
  `false`". WeekView's planning mode passes `:show-checkbox="mode === 'completion'"`, i.e. literal
  `false` in planning mode — that must hide it.
- **Do not** call `store.toggleItem` for checklist-tasks. `toggleItem` looks the item up in the tree
  and would silently no-op (see issue 002 background); the correct behavior is `onChecklistDone?.()`
  which opens the completion modal.
- **Do not** remove the "✓ Complete task" button PR #71 added to `MobilePlanningSheet`'s Actions
  tab — checkbox and sheet action coexist.
- **Do not** remove or alter the swipe-to-complete handlers in DayView, the long-press handler, or
  the PR #66 click model (card click = details toggle). This fix only adds the checkbox back.
- Note `toggleItem`'s side effects are intentional: completing the last item auto-archives the
  checklist, and un-completing re-adds the item to today's plan. Don't "fix" those here.

## Acceptance criteria

- Day view, desktop (no touch): clicking the checkbox completes a task in one click; it moves to
  the Completed section; clicking its checkbox there un-completes it.
- Week view → Completion mode: every card shows a checkbox; ticking a regular task completes it;
  ticking a checklist-task opens the Complete-checklist modal. Planning mode shows **no** checkbox.
- Backlog view: no checkboxes (unchanged).
- Clicking the checkbox does **not** toggle the card's details panel and does not open the sheet.
- `cd src/get-it-done && npm run build` passes with zero errors.
