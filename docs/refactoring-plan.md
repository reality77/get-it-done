# Refactoring Plan: get-it-done

> Analysis of the current codebase with prioritized recommendations for improving maintainability, testability, and alignment with Vue best practices and Atomic Design principles.
> No implementation is included here — this is a reference document.

---

## Priority Summary

| Priority | Area | Effort | Impact |
|---|---|---|---|
| ✅ 🔴 Critical | Split `checklists.ts` god store | Large | Very high |
| 🔴 Critical | Fix Atomic Design violations (molecules with store access) | Small | High |
| 🟡 High | Extract repeated patterns (vFocus, edit state, keyboard, action builders) | Medium | High |
| 🟡 High | Split oversized molecules (TaskCard 244L, ItemGroup 214L) | Medium | High |
| 🟠 Medium | Centralize magic numbers/constants | Small | Medium |
| 🟠 Medium | Extract App.vue composables (keepAlive, syncStatus) | Small | Medium |
| 🟠 Medium | Fix props drilling / store access inconsistency | Medium | Medium |
| 🔵 Low | Add Vue Router | Large | Medium |
| 🔵 Low | Add Vitest test infrastructure | Medium | High long-term |

---

## 1. 🔴 CRITICAL: God Store (`checklists.ts` — 923 lines)

**Problem:** A single Pinia store owns 15+ distinct domains: CRUD, tree traversal, day planning, snooze, weekly review, PouchDB sync, localStorage, and a scoring algorithm. This makes it hard to test, reason about, or modify any one concern without risk.

### Recommended splits

| Proposed File | Responsibility |
|---|---|
| `stores/checklists.ts` | Core CRUD only (create/read/update/delete/archive) |
| `composables/useTreeHelpers.ts` | `walkNodes`, `findItemDeep`, `countItems`, `countDone` |
| `composables/useSyncManager.ts` | PouchDB sync, exponential backoff retry, `syncStatus` |
| `composables/useDayPlanning.ts` | `suggestDayPlan`, `dayPlanItems`, `selectForToday` |
| `composables/useSnoozeOptions.ts` | `getSnoozeOptions`, snooze date math |
| `stores/planMeta.ts` | `PlanMeta`, localStorage reads/writes |

### Specific patterns to fix inside `checklists.ts`

**Repeated 4-line boilerplate** (lines 401–452): 6+ functions (`setItemPriority`, `setItemEffort`, `snoozeItem`, `activateItem`, `sendItemToSomeday`, `toggleItemDayPlan`) share the same setup pattern. Extract a `withItem()` helper:

```ts
function withItem(ref: ChecklistItemId, fn: (item: ChecklistItem) => void): void {
  const cl = getChecklist(ref.checklistId)
  if (!cl) return
  const item = findItemDeep(cl.items, ref.itemId)
  if (!item) return
  fn(item)
  void upsertChecklist(cl)
}
```

**Magic numbers** scattered across the file (lines 179, 537, 598) — move to `src/config/constants.ts`:

```ts
export const SYNC_INITIAL_RETRY_MS = 5_000
export const SYNC_MAX_RETRY_MS = 60_000
export const DAY_PLAN_MAX_ITEMS = 5
export const HTTP_UNAUTHORIZED_STATUSES = [401, 403]
export const DAY_PLAN_PRIORITY_SCORES: Record<TaskPriority, number> = { urgent: 30, important: 20, secondary: 10 }
export const DAY_PLAN_EFFORT_SCORES: Record<TaskEffort, number> = { small: 3, medium: 2, large: 1 }
```

**Auto-archive side-effect in `toggleItem`** (lines 755–778): The function toggles done state AND auto-archives checklists. These are separate concerns and should be split.

---

## 2. 🔴 CRITICAL: Atomic Design Violations in Molecules

Atoms and molecules must be **presentation-only** — they must not access the Pinia store directly. Currently:

| Component | Violation | Fix |
|---|---|---|
| `molecules/ItemGroup.vue` line 16 | Calls `useChecklistStore()` for 8 mutations | Lift all mutations to `ChecklistCard` organism; receive as emitted events |
| `molecules/SnoozeMenu.vue` line 3 | Imports `getSnoozeOptions` from store file | Receive `options: SnoozeOption[]` as a prop instead |

### Oversized molecules that should be split

**`TaskCard.vue` (244 lines)** contains text editing, snooze menu state, swipe gestures, mobile Teleport sheet, and action buttons. Should become:
- `TaskCard.vue` — display + checkbox only
- `TaskCardActions.vue` — action button strip
- `TaskCardMobileSheet.vue` — Teleport bottom sheet content

**`ItemGroup.vue` (214 lines)** handles recursive rendering, title editing, item adding, and group adding — too many responsibilities for a molecule.

---

## 3. 🟡 HIGH: Repeated Patterns With No Abstraction

### a) `vFocus` custom directive duplicated
Defined identically in `ItemRow.vue` (lines 22–28) and `TaskCard.vue` (lines 37–43).

**Fix:** Register once globally in `main.ts`, or extract to `src/directives/vFocus.ts` and import where needed.

### b) Edit state pattern duplicated 5+ times
`isEditing`, `editText`, `startEdit()`, `confirmEdit()`, `cancelEdit()` appear in `ItemRow`, `TaskCard`, `ItemGroup`, `ChecklistCard`.

**Fix:** Extract `composables/useEditableField.ts`:
```ts
export function useEditableField(initialValue: () => string, onConfirm: (v: string) => void) {
  const isEditing = ref(false)
  const editText = ref('')
  function startEdit() { editText.value = initialValue(); isEditing.value = true }
  function confirmEdit() { if (editText.value.trim()) onConfirm(editText.value.trim()); isEditing.value = false }
  function cancelEdit() { isEditing.value = false }
  return { isEditing, editText, startEdit, confirmEdit, cancelEdit }
}
```

### c) Keyboard handler pattern duplicated
`Enter` → confirm, `Escape` → cancel logic appears in `ItemGroup.vue` (lines 103–108) and `ChecklistCard.vue` (lines 87–92).

**Fix:** Extract `composables/useKeyboardConfirm.ts`.

### d) Task action builder duplicated across views
`DayView.vue` (lines 22–29), `BacklogView.vue` (lines 21–34), and `WeeklyReviewPanel.vue` (lines 20–32) all build `ButtonActionDef[]` arrays with the same `ChecklistItemId` construction pattern.

**Fix:** Extract `composables/useTaskActions.ts` with view-specific action factories.

### e) Checklist creation form duplicated
`ActiveView.vue` (lines 32–42) and `TemplatesView.vue` (lines 34–42) have identical form markup (input + button).

**Fix:** Extract `molecules/ChecklistCreationForm.vue`.

---

## 4. 🟠 MEDIUM: Missing Constants Centralization

Scattered hardcoded values that should live in `src/config/constants.ts`:

| Value | Location | Meaning |
|---|---|---|
| `5 * 60 * 1000` | `App.vue` line 44 | Keep-alive interval (ms) |
| `72` | `TaskCard.vue` line 81 | Swipe gesture threshold (px) |
| `3500` | `DayView.vue` line 45 | Celebration animation duration (ms) |
| `14` | `checklists.ts` | Stale snooze threshold (days) |
| `7` | `checklists.ts` | Weekly review interval (days) |
| `30, 20, 10` | `checklists.ts` line 522 | Day plan priority scores |
| `3, 2, 1` | `checklists.ts` line 523 | Day plan effort scores |
| `5_000 / 60_000` | `checklists.ts` lines 179, 605 | Sync retry min/max delay |

---

## 5. 🟠 MEDIUM: App.vue Composable Extractions

Two self-contained pieces of `App.vue` logic should become composables:

- **`useKeepAlive.ts`:** Encapsulate `startKeepAlive`/`stopKeepAlive` + visibility check + `setInterval` lifecycle (App.vue lines 28–50).
- **`useSyncStatusDisplay.ts`** (or `src/config/syncStatusConfig.ts`): Move `syncStatusClasses` and `syncStatusTitles` maps out of `App.vue` (lines 150–164).

---

## 6. 🟠 MEDIUM: Props Drilling & Communication Inconsistency

### Deep relay through `TasksView.vue`
`TasksView.vue` receives 9 props from `App.vue` and re-emits 13 events — it is a **pure relay with zero own logic**. The data chain is:

```
App.vue (owns state) → TasksView.vue (relay only) → DayView / WeekView / BacklogView / WeeklyReviewPanel
```

**Option A (minimal):** Have child organisms read computed state directly from the Pinia store instead of via props. Only pass contextual data that the store doesn't own.

**Option B (recommended):** Move all computed view state (`dayPlanItems`, `backlogItems`, `activeTrackedItems`, etc.) into composables consumed directly by each organism.

### Dual communication paths in `ChecklistCard.vue`
`ChecklistCard.vue` (organism) both calls store mutations directly AND emits events — mixing two patterns for the same type of operation.

**Fix:** Organisms should use the store directly for all reads and writes. Custom events should be reserved for signals that cross the component boundary upward (e.g., requesting a tab change).

---

## 7. 🔵 LOW: Missing Vue Router

Tab and view state is stored in plain `ref`s with no URL integration:

```ts
// App.vue lines 15, 76
const activeTab = ref<'active' | 'templates' | 'archive' | 'tasks'>('tasks')
const currentTaskView = ref<TaskView>('day')
```

**Consequences:** No deep-linking, no browser back/forward history, no shareable URLs, no session restoration after page reload.

**Recommendation:** Add Vue Router with routes:
- `/tasks/day`, `/tasks/week`, `/tasks/backlog`
- `/lists`, `/templates`, `/archive`

This is a larger change but significantly improves UX and enables navigation-level testing.

---

## 8. 🔵 LOW: Missing Test Infrastructure

No test files exist anywhere in the project. The most complex logic (`suggestDayPlan`, snooze date math, PouchDB sync retry, `migrateNodes`) has zero coverage.

**Recommendation:** Add [Vitest](https://vitest.dev/) (Vite-native, zero extra config):

```json
{
  "scripts": {
    "test": "vitest",
    "coverage": "vitest --coverage"
  }
}
```

**Priority test targets:**
1. `suggestDayPlan()` — scoring + sorting algorithm
2. `getSnoozeOptions()` — date math correctness
3. `migrateNodes()` — data migration safety (prevents data loss on format changes)
4. PouchDB sync exponential backoff retry logic

---

## Files to Modify

| File | Change |
|---|---|
| `src/stores/checklists.ts` | Extract tree helpers, sync, day planning, snooze, plan meta |
| `src/components/molecules/ItemGroup.vue` | Remove store access; lift mutations to organism via emits |
| `src/components/molecules/SnoozeMenu.vue` | Replace store import with `options` prop |
| `src/components/molecules/TaskCard.vue` | Split into 3 components |
| `src/App.vue` | Extract keep-alive composable; move sync status maps |
| `src/main.ts` | Register `vFocus` directive globally |

## New Files to Create

| File | Purpose |
|---|---|
| `src/config/constants.ts` | All magic numbers and app-wide configuration |
| `src/composables/useTreeHelpers.ts` | `walkNodes`, `findItemDeep`, `countItems`, `countDone` |
| `src/composables/useSyncManager.ts` | PouchDB sync + exponential backoff |
| `src/composables/useDayPlanning.ts` | Day plan suggestion and scoring |
| `src/composables/useEditableField.ts` | Reusable inline edit state |
| `src/composables/useKeyboardConfirm.ts` | Enter/Escape keyboard handler |
| `src/composables/useTaskActions.ts` | `ButtonActionDef[]` factory per view |
| `src/composables/useKeepAlive.ts` | Session keep-alive timer |
| `src/directives/vFocus.ts` | Global `v-focus` directive |
| `src/components/molecules/ChecklistCreationForm.vue` | Shared checklist creation form |

---

## Verification After Any Refactoring

1. Run `npm run build` from `src/get-it-done/` — must pass with zero TypeScript errors (`vue-tsc`)
2. Manually verify core flows: create checklist → add items → toggle done → archive
3. Manually verify task features: snooze, weekly review trigger, day plan suggestion
4. Manually verify sync: PouchDB local persistence + CouchDB sync if available
