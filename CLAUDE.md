# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

`get-it-done` is a Vue 3 + TypeScript + Vite + Tailwind CSS v4 task-management app. Composition API with `<script setup>` throughout. Offline-first with PouchDB/CouchDB sync. Components follow **Atomic Design** (atoms → molecules → organisms → templates → page).

## Project Root

The Vite app lives at `src/get-it-done/` — **all commands must be run from there**:

```bash
cd src/get-it-done
npm run dev        # Start dev server with HMR
npm run build      # Type-check (vue-tsc) then bundle with Vite
npm run preview    # Preview production build locally
```

> **Run `npm run build` at the end of every code session** to catch type errors before committing.

No lint or test commands are configured yet.

## Architecture

**Entry flow:** `index.html` → `src/main.ts` → `src/App.vue`

**App.vue** owns tab navigation (`activeTab: 'tasks' | 'active' | 'templates' | 'archive'`), session keep-alive (pings CouchDB every 5 min), and visibility-based pause/resume.

### State — Pinia stores (`src/stores/`)

- **`checklists.ts`** (`useChecklistStore`) — primary store; manages checklists, items, groups, task-tracking, day planning, snooze, weekly review, and PouchDB↔CouchDB sync
- **`auth.ts`** (`useAuthStore`) — CouchDB `/_session` login/logout/checkSession; reads `VITE_COUCH_USER` (default `admin`)

### Types (`src/types.ts`)

String literal unions only — no enums.

| Type | Values |
|---|---|
| `ChecklistKind` | `'one-time' \| 'template' \| 'run'` |
| `TaskStatus` | `'active' \| 'snoozed' \| 'someday'` |
| `TaskPriority` | `'urgent' \| 'important' \| 'secondary'` |
| `TaskEffort` | `'small' \| 'medium' \| 'large'` |
| `TaskView` | `'day' \| 'week' \| 'backlog'` |

Key interfaces: `Checklist`, `ChecklistItem`, `ChecklistItemGroup`, `ChecklistNode` (union), `TrackedItemRef`, `PlanMeta`, `SwipeActionDef`, `ButtonActionDef`.

### Components (`src/components/`)

- **atoms/** — `AppButton`, `AppInput`, `AppCheckbox`, `AppBadge`, `TaskStatusDot`
- **molecules/** — `ItemRow`, `TabItem`, `TaskCard`, `ItemGroup`, `PriorityBadge`, `EffortBadge`, `KindBadge`, `SnoozeMenu`, `DayPlanBar`, `TrackButton`, `MobilePlanningSheet`
- **organisms/** — `ChecklistCard`, `ArchiveCard`, `TabBar`, `DayView`, `WeekView`, `BacklogView`, `WeeklyReviewPanel`, `PasswordPrompt`
- **templates/** — `ActiveView`, `TemplatesView`, `ArchiveView`, `TasksView`

### Composables (`src/composables/`)

- **`useSwipeAction.ts`** — wraps `@vueuse/core useSwipe`; provides swipe offset, left/right progress, and a CSS transform style object for swipe-reveal actions on `TaskCard`

### Styling

Tailwind CSS v4 — `@import "tailwindcss"` in `src/style.css`, no config file needed. Dark palette: `zinc-950/900` backgrounds, `violet-600` primary, `red-400` danger.

## Key Features

- **Checklist kinds:** `one-time` (auto-archives when 100% done), `template` (reusable), `run` (template instance, labeled "Title — Run #N")
- **Task tracking:** opt-in per checklist; unlocks priority, effort, status, snooze, day-plan selection, `completedAt` timestamp
- **Day planning:** `selectedForToday` flag + scoring algorithm (priority × effort + randomization); resets on date change
- **Weekly review:** triggers on Mondays, stale snoozes (14+ days), or 7+ days since last review
- **Sync:** PouchDB (IndexedDB locally) ↔ CouchDB (remote); live two-way replication with exponential-backoff retry (5s–60s); `SyncStatus`: `'synced' | 'syncing' | 'offline' | 'pending' | 'unauthorized'`
- **Offline-first:** app loads local data before auth; works offline with `pending` sync status

## TypeScript

Strict mode (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`). Use string literal union types — never enums or namespaces.

## Product Plan

Full epics, user stories, and technical design: `docs/plan.md`.
