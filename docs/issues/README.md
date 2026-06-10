# Repository Analysis — Remediation Plan

**Date:** 2026-06-10
**Analyzed:** entire repo — Vue app (`src/get-it-done/`), push server (`src/push-server/`), docs, build config.
**Baseline:** re-verified against `main` @ `dcffd89` (PRs #64–#72 included). Build passes with zero errors there.

> **Re-review note (same day):** the first pass was done on `feat/taskcarddetails2` @ `cd0dcf1`;
> `main` then advanced by 9 commits (#64–#72: TaskCard click reversal, planning-sheet redesign with
> Details/Actions tabs, backlog quick filter + snoozed sort, FAB scheduling fields, per-view
> scrolling, deadline label picker). Every issue file was re-checked against `dcffd89`. Net effect:
> issue 002's "hide Delete for checklist-tasks" part landed in #71 and was removed from the file;
> 005, 006, 011, 012, 014, 015, 017 were updated in place; 001, 003, 004, 007–010, 013, 016 are
> unchanged and still accurate. Files that needed changes carry a "Re-verified" banner at the top.

This directory contains one markdown file per detected issue. Each file is a **self-contained work order
written for an LLM coding agent (Claude Opus or Sonnet)**: it states the problem with quoted code
evidence, the exact fix to apply, explicit guardrails against likely misunderstandings, and acceptance
criteria.

---

## How to execute an issue file (read this first, every time)

These rules apply to **every** issue and exist because they are the most common failure modes for an
agent working in this repo:

1. **Project root is `src/get-it-done/`, not the repo root.** All npm commands (`npm run build`,
   `npm run dev`) must be run from `src/get-it-done/`. The push server lives in `src/push-server/`
   and has its own `package.json` (`npm run build` = `tsc`).
2. **Line numbers in these files are approximate.** The codebase moves. Always locate code by
   searching for the **quoted snippet**, never by line number alone. If a quoted snippet cannot be
   found, STOP and report — do not guess at an equivalent location.
3. **Do not trust `CLAUDE.md` or `docs/plan.md` for component/store inventory.** They are stale
   (see issue 016). Trust the actual source files.
4. **TypeScript conventions:** strict mode, `noUnusedLocals`, `noUnusedParameters`, and
   `noUncheckedIndexedAccess` (inherited from the `@vue/tsconfig` base — indexing into arrays
   yields `T | undefined`; prefer destructuring defaults over non-null assertions, see commit
   `05f4526`). String literal union types only — **never** introduce `enum` or `namespace` (build
   uses `erasableSyntaxOnly`). Vue 3 Composition API with `<script setup lang="ts">`.
5. **Data lives in production CouchDB/PouchDB documents.** Never rename or remove a persisted field
   without a migration path. If you add a field to `Checklist`, you MUST also add it to
   `docToChecklist()` in `src/get-it-done/src/lib/couchdb.ts` — that function rebuilds the object
   field-by-field, and any field not listed there is silently dropped on reload.
6. **Verification floor for every issue:** `cd src/get-it-done && npm run build` must pass with zero
   errors. Issues touching the push server additionally need `cd src/push-server && npm run build`.
   There is no test suite (yet).
7. **Stay in scope.** Each issue file has an "Out of scope" section. Do not fix neighboring problems
   you notice — they are almost certainly covered by another file in this directory.

---

## Issue index

### Bugs (fix first — small, high-confidence, user-visible)

| # | File | Severity | Effort | One-line summary |
|---|------|----------|--------|------------------|
| 001 | [001-delete-action-filter-noop.md](001-delete-action-filter-noop.md) | High | S | `.filter(a => a.label !== 'Delete')` never matches — label is `'✕'`, `'Delete'` is the *title* |
| 002 | [002-checklist-task-mutations-silently-fail.md](002-checklist-task-mutations-silently-fail.md) | High | M | Rename/comment/URL on a checklist-level task silently does nothing (delete-button half fixed by #71) |
| 003 | [003-xss-in-task-comment-vhtml.md](003-xss-in-task-comment-vhtml.md) | High (security) | S | Stored XSS: task comment rendered with `v-html` |
| 004 | [004-clear-day-plan-not-persisted.md](004-clear-day-plan-not-persisted.md) | Medium | S | "Clear" day plan never persists — selections come back on reload |
| 005 | [005-taskcard-checkbox-regression.md](005-taskcard-checkbox-regression.md) | High | M | TaskCard checkbox dropped in PR #63 — Week "Completion" mode is inert; one-tap completion lost |
| 006 | [006-utc-local-date-handling.md](006-utc-local-date-handling.md) | High | M | All "today" math uses UTC dates; app misbehaves for any non-UTC user |
| 007 | [007-weekly-review-trigger-mismatch.md](007-weekly-review-trigger-mismatch.md) | Low | S | Weekly review triggers on the wrong snooze condition (due instead of stale-14d) |
| 008 | [008-push-server-ignores-checklist-level-tasks.md](008-push-server-ignores-checklist-level-tasks.md) | Medium | M | Push server never fires reminders/snooze alerts for `trackMode='checklist'` tasks; also notifies for done/archived items |
| 009 | [009-push-scheduler-timezone-and-missed-ticks.md](009-push-scheduler-timezone-and-missed-ticks.md) | Medium | M | Push scheduler uses server-local time vs client-local `HH:MM`; 60-second window drops reminders on restart |

### Design issues

| # | File | Severity | Effort | One-line summary |
|---|------|----------|--------|------------------|
| 010 | [010-push-broadcast-multi-user-leak.md](010-push-broadcast-multi-user-leak.md) | Medium | S–M | `sendToAll` broadcasts task contents to every subscribed CouchDB user — implicit single-user assumption |
| 011 | [011-templates-archive-unreachable.md](011-templates-archive-unreachable.md) | High | L | Templates & Archive features are fully implemented but unreachable — no tab renders them |
| 012 | [012-vestigial-week-plan-flag.md](012-vestigial-week-plan-flag.md) | Medium | M | `selectedForWeek` is written by three UIs but read by nothing — "Add to week" misleads |

### Architecture issues

| # | File | Severity | Effort | One-line summary |
|---|------|----------|--------|------------------|
| 013 | [013-sync-conflict-strategy.md](013-sync-conflict-strategy.md) | Medium | L | Whole-document last-write-wins; CouchDB conflicts never resolved; standalone-checklist first-sync conflict |
| 014 | [014-write-batching-per-checklist.md](014-write-batching-per-checklist.md) | Medium | M | Single user actions issue 2–8 racing PouchDB puts on the same doc, relying on 409-retry to converge |
| 015 | [015-plan-meta-device-local.md](015-plan-meta-device-local.md) | Low | M | `planMeta` (day-plan date, last review) is per-device localStorage while the flags it governs are synced |

### Misconceptions / documentation

| # | File | Severity | Effort | One-line summary |
|---|------|----------|--------|------------------|
| 016 | [016-documentation-drift.md](016-documentation-drift.md) | High (for agents) | S | CLAUDE.md & docs/plan.md describe a previous incarnation of the app and actively mislead |
| 017 | [017-minor-cleanups.md](017-minor-cleanups.md) | Low | S | Batch of small dead-code / UX / dependency cleanups |

---

## Recommended execution order

1. **016 first** if agents will do the other work — it removes the main source of misdirection.
2. Then the independent small bugs: **001, 003, 004, 007** (each is a self-contained ≤30-line change).
3. Then **005** (restores completion UX; verify before/after manually), then **002** (touches the same
   store functions other issues reference — do it before 014).
4. Then **006** (cross-cutting date handling; do it before 009 so client and server use the same model).
5. Push server: **008, 009, 010** (can be done in one session; they touch the same files).
6. Product decision required: **011** and **012** — read the "Decision required" section in each;
   default recommendations are given but the user should confirm.
7. Architecture last: **014**, then **013**, then **015** (014 simplifies 013's territory).

Issues that conflict if run in parallel: 002+014 (both touch store mutation functions), 008+009+010
(same push-server files), 006+009 (date helpers). Run those sequentially.

---

## Known issues intentionally NOT re-reported here

`docs/architecture-review.md` (2026-05-21) and `docs/refactoring-plan.md` already track:
M4 (manual `persistPlanMeta()` calls — folded into issue 015 here), L1 (cascade delete is local-only —
folded into 013), L4 (no group-nesting depth limit), L3 (`Math.random()` in scoring untestable),
missing test infrastructure, and missing Vue Router. Decisions marked "will not implement" in that
review (session-only `dismissedUntil`) are respected and must not be "fixed".
