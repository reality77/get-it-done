# 016 — CLAUDE.md and docs/plan.md describe a previous incarnation of the app

| | |
|---|---|
| **Type** | Misconception generator (documentation drift) |
| **Severity** | High *for agent-driven development* — these files are injected into every Claude session and actively mislead |
| **Confidence** | Certain |
| **Effort** | Small (writing, no code) |
| **Files** | `CLAUDE.md` (repo root), `docs/plan.md` |

## Problem

`CLAUDE.md` is loaded into context for every agent session, and it is wrong about the app's current
shape. Verified discrepancies:

| CLAUDE.md claims | Reality |
|---|---|
| `App.vue` owns tabs `'tasks' \| 'active' \| 'templates' \| 'archive'` | Tabs are `'today' \| 'week' \| 'backlog' \| 'checklists'`; templates/archive currently unmounted (issue 011) |
| atoms: `AppButton`, `AppInput`, `AppCheckbox`, `AppBadge`, `TaskStatusDot` | atoms are `VButton`, `VBadge`, `VCard`, `VChip`, `VField`, `VSegmented`, `VToggle`, `AppCheckbox`, `DeadlineBar`, `EffortAvatar`, `TaskStatusDot` |
| templates: `ActiveView`, `TemplatesView`, `ArchiveView`, `TasksView` | There is **no `TasksView`**; it was dissolved into App.vue-mounted organisms |
| `checklists.ts` "manages … day planning, snooze, weekly review, and PouchDB↔CouchDB sync" | Those were extracted to `useDayPlanning.ts`, `useSyncManager.ts`, `useSnoozeOptions.ts`, `stores/planMeta.ts` |
| Composables section lists only `useSwipeAction.ts` | Nine composables exist |
| No mention at all | PWA/service worker (`sw.ts`, vite-plugin-pwa), push notifications, `src/push-server/` backend, `comment`/`url` item fields, `TrackMode`/checklist-level tasks, deadlines/reminders, standalone Tasks checklist, `BottomNavBar` |
| "Weekly review: triggers on … stale snoozes (14+ days)" | Code currently uses due-snoozes (issue 007 aligns code to this doc — keep the doc's wording) |

`docs/plan.md` describes the original localStorage-only checklist app ("Data is stored in
`localStorage`", `useChecklists.ts` composable, no tasks/planning/sync at all), yet `CLAUDE.md`
points to it as "Full epics, user stories, and technical design". Several `.claude/commands/*` and
skills (`plan-status`, `component-audit`) consume these files, so the drift propagates into tooling.

This drift has direct cost: an agent told to "follow the architecture in CLAUDE.md" will recreate
`TasksView`, import `AppButton`, or look for sync code inside the store.

## Fix

### 1. Rewrite `CLAUDE.md` from the actual source tree

Keep the existing section structure (Project Overview / Project Root / Architecture / Types /
Components / Composables / Styling / Key Features / TypeScript / Product Plan) and correct it:

- Tab model: `today | week | backlog | checklists`; `App.vue` also owns session keep-alive,
  visibility handling, login prompt, notification settings modal, and the standalone-task FAB.
- Stores: `checklists.ts` (façade: CRUD + re-exports), `auth.ts`, `planMeta.ts`.
- Composables: enumerate all nine with one line each (`useDayPlanning`, `useSyncManager`,
  `useTreeHelpers`, `useSnoozeOptions`, `useTaskActions`, `useSwipeAction`, `useEditableField`,
  `useKeyboardConfirm`, `useNotifications`).
- Types: add `TrackMode`, `comment`/`url`, `deadline`/`reminders`, checklist-level task fields,
  `TrackedItemRef.isChecklistTask`.
- Components: regenerate the atoms/molecules/organisms/templates lists from
  `ls src/get-it-done/src/components/*` — do not write the list from memory.
- New sections: **PWA & Service Worker** (injectManifest, `sw.ts`, push + notificationclick) and
  **Push server** (`src/push-server/`, Fastify, CouchDB session auth, cron scheduler; build/run
  commands).
- Key Features: add tracking modes, deadlines, reminders, comments/URLs, standalone tasks,
  celebration; keep the documented weekly-review trigger wording ("stale snoozes (14+ days)") —
  issue 007 makes code match it.
- Keep it **concise** — CLAUDE.md is prompt payload; aim for the current file's length, not a
  novel.

### 2. Mark `docs/plan.md` as historical and add a current-state plan

- Prepend a clearly-visible banner to `docs/plan.md`:
  `> **HISTORICAL DOCUMENT** (original v1 plan, pre-tasks/pre-sync). For current architecture see CLAUDE.md and docs/architecture-review.md. Epics 1–3 statuses: see docs/issues/011.`
  Do not rewrite its content — it is useful history and `docs/plan-status` references it.
- Update the `## Product Plan` pointer in CLAUDE.md to say plan.md is historical and list where
  current truth lives (`docs/architecture-review.md`, `docs/push-notifications.md`,
  `docs/issues/`).

## Guardrails — read before editing

- **Generate lists from the filesystem, not from memory or from this issue file.** The component
  inventory above may itself drift by the time this executes.
- Do not change any source code in this issue. Docs only.
- Do not delete `docs/plan.md`, `docs/architecture-review.md`, or `docs/refactoring-plan.md`.
- Do not document aspirational behavior: if issues 011/012 have not landed yet, CLAUDE.md must
  state that Templates/Archive views exist but are currently not mounted (one honest sentence), not
  pretend they're reachable.
- Preserve CLAUDE.md's existing operational instructions that are still true: commands run from
  `src/get-it-done/`, `npm run build` at end of session, string-literal unions / no enums, strict
  TS flags.

## Acceptance criteria

- Every component, store, and composable named in CLAUDE.md exists at the stated path
  (spot-check by grep).
- No reference to `TasksView`, `AppButton`, `AppInput`, `AppBadge`, or the
  `'tasks'/'active'/'templates'/'archive'` tab model remains in CLAUDE.md.
- `docs/plan.md` opens with the historical banner.
- `cd src/get-it-done && npm run build` still passes (nothing should have changed, but run it —
  cheap insurance).
