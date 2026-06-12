# 011 — Templates & Archive are fully implemented but unreachable from the UI

| | |
|---|---|
| **Type** | Architecture / product gap (orphaned features) |
| **Severity** | High (two documented epics are dead; archived data is invisible and undeletable) |
| **Confidence** | Certain — verified by import graph |
| **Effort** | Large-ish (mostly wiring, no new logic) |
| **Files** | `src/get-it-done/src/App.vue`, `TabBar.vue`, `BottomNavBar.vue`, `ActiveView.vue` (or a new `ChecklistsView.vue`), read-only reuse: `TemplatesView.vue`, `ArchiveView.vue`, `ArchiveCard.vue` |

## Problem

`App.vue` renders four tabs: `today | week | backlog | checklists`, and the `checklists` tab mounts
only `ActiveView`. Grep-verified consequences:

- `TemplatesView.vue`, `ArchiveView.vue`, `ArchiveCard.vue` are **imported by nothing**.
- Store APIs `templates`, `archivedChecklists`, `runTemplate` are **called by nothing**.
- `ChecklistCard.vue` emits `run` — no listener anywhere; its Delete button renders only when
  `checklist.archived === true`, but archived checklists are never rendered → **no checklist can
  ever be deleted from the UI**.
- `handleCreateChecklist` in `App.vue` hardcodes `kind: 'one-time'` → **templates cannot be
  created**.
- The only archive-related affordances left: swipe-left a checklist card to archive it, and
  "Unarchive" via the completed checklist-task swipe in DayView (only for `trackMode: 'checklist'`).
  Once archived, a normal checklist is gone from view permanently.

Product docs (`docs/plan.md` Epics 2 & 3, `CLAUDE.md`) still describe Templates and Archive as
features. This is the single biggest gap between documentation and reality.

## Decision required (default given)

Two coherent endpoints exist:

- **(A) Restore access** — recommended default, implemented below. The feature code is finished and
  builds; it just needs mounting.
- **(B) Formally drop templates & archive browsing** — delete the orphaned components and store
  APIs, change auto-archive to hard-delete or keep-as-hidden, and rewrite the docs.

Option B destroys access to data users may already have in production CouchDB (archived
checklists), so do **not** choose it without explicit user confirmation. Implement A.

## Fix (Option A): sub-tabs inside the Checklists tab

Do not add top-level tabs — the bottom mobile nav has exactly 4 slots and the team intentionally
consolidated. Instead give the Checklists tab three sections:

1. **Create `src/get-it-done/src/components/templates/ChecklistsView.vue`** with a small segmented
   control (reuse the atom `VSegmented.vue` — see its usage in `SnoozeModal.vue`) switching a local
   `ref<'active' | 'templates' | 'archive'>('active')`:
   - `active` → render the existing `ActiveView` content (you may either embed `ActiveView` as-is
     or move its template in; embedding as-is is less risky — keep `ActiveView` untouched).
   - `templates` → render `TemplatesView`.
   - `archive` → render `ArchiveView`.
2. **Wire the data and events** (call the store directly inside `ChecklistsView` — leaf-store access
   is this codebase's established pattern; see `DayView`):
   - `TemplatesView` props: `:templates="store.templates"`. Events: `@create` →
     `store.createChecklist('template', name, [])`; `@run` → `store.runTemplate(id)`; `@delete` →
     `store.deleteChecklist(id)` (note: deleting a template cascades to its runs — that is
     intended, per `deleteChecklist`'s implementation and plan.md E2-US7).
   - `ArchiveView` props: `:checklists="store.archivedChecklists"`. Events: `@unarchive` →
     `store.unarchiveChecklist(id)`; `@delete` → `store.deleteChecklist(id)`.
   - Keep `ActiveView`'s existing prop/event wiring exactly as `App.vue` has it today (move those
     bindings into `ChecklistsView`, or keep them in App.vue and only relocate the rendering —
     choose the smaller diff).
3. **`App.vue`**: since PR #69 the checklists tab renders as a scroll wrapper around the view:

   ```html
   <div v-else-if="activeTab === 'checklists'" class="flex-1 overflow-y-auto pb-20 md:pb-0">
     <ActiveView ... />
   </div>
   ```

   Replace the inner `<ActiveView ...>` with `<ChecklistsView ...>` and keep the wrapper div —
   PR #69 made each view own its scroll behavior; preserve that (BacklogView manages its own
   scroll internally; your `ChecklistsView` content can rely on the wrapper). Remove now-unused
   imports/bindings. The `newlyCreatedId` focus mechanism must keep working for one-time
   checklists.
4. **`ChecklistCard` run wiring**: `TemplatesView` already forwards `@run`; nothing to change in
   the card.
5. **Template creation kind**: `TemplatesView`'s `ChecklistCreationForm` emits a bare name; the
   handler decides the kind (step 2). Do not modify `ChecklistCreationForm` to add a kind picker —
   the per-section forms already disambiguate.

## Guardrails — read before editing

- **Do not delete** `TemplatesView/ArchiveView/ArchiveCard` "because they're unused" — the entire
  point is to mount them.
- **Do not add tabs** to `TabBar.vue` / `BottomNavBar.vue`. Their union type
  `'today' | 'week' | 'backlog' | 'checklists'` stays unchanged.
- `templates` computed includes the standalone-tasks checklist? No — standalone is `kind:
  'one-time'`; but double-check `archivedChecklists` excludes `STANDALONE_CHECKLIST_ID` (it does,
  by filter). Do not remove those exclusions.
- The Delete button in `ChecklistCard` (visible only when archived) becomes reachable via
  `ArchiveView`… no — `ArchiveView` uses `ArchiveCard`, which has its own Restore/Delete buttons.
  The `ChecklistCard` archived-delete branch stays dead in Active view; leave it (or remove it in
  issue 017, not here).
- Deleting a checklist permanently deletes synced data. Keep `ArchiveCard`'s existing
  confirm-free Delete behavior as-is in this issue (adding a confirm dialog is a separate UX
  decision; note it in your PR description).
- `runTemplate` throws if the template id is missing — wire it directly; no extra guards needed.

## Acceptance criteria

- Checklists tab shows three sections: Active / Templates / Archive.
- Create a template → appears under Templates; Run → instance "Title — Run #1" appears under
  Active; running again yields "Run #2"; the template itself is unchanged.
- Archive a checklist (swipe or 🗄) → it appears under Archive with its archive date; Restore
  returns it to Active; Delete removes it permanently (and survives reload).
- Deleting a template removes its runs from Active.
- One-time checklist creation + auto-focus-new-checklist behavior unchanged in Active.
- `cd src/get-it-done && npm run build` passes with zero errors.
