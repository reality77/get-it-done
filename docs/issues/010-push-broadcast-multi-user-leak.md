# 010 — Push notifications broadcast task contents to every subscribed user

| | |
|---|---|
| **Type** | Design / security (information disclosure under multi-user deployment) |
| **Severity** | Medium (none in strict single-user use; real leak otherwise) |
| **Confidence** | High |
| **Effort** | Small–Medium |
| **Files** | `src/push-server/src/scheduler.ts`, `src/push-server/src/index.ts` (env handling), `src/push-server/README` note (create if absent) |

## Problem

The system has an **implicit single-account architecture** that the push server half-contradicts:

- The web app syncs everything to **one shared CouchDB database** (`get-it-done`). There is no
  per-user document ownership; whoever can authenticate sees all data. The default login is the
  `admin` user (`VITE_COUCH_USER`).
- The push server, however, *does* track `userId` per subscription (taken from the CouchDB session)
  and even has `sendToUser` — used for daily reminders only.
- But `runSnoozeCheck` and `runTaskReminders` in `scheduler.ts` use **`sendToAll`**, pushing task
  titles ("\"<task text>\" is ready for you.", "⏰ Reminder: <task text>") to **every subscription of
  every CouchDB user** that ever subscribed.

If a second CouchDB user (e.g. a future `_users` entry, or anyone who once authenticated and
subscribed) exists, they receive the contents of the primary user's tasks. Conversely, the data
model has no way to scope tasks to a user, so "fixing" this with per-user filtering of the data is
impossible without a data-model redesign.

## Decision (made): make the single-account assumption explicit and enforced

Do **not** attempt per-user data partitioning — that is a product redesign. Instead:

1. **Server: restrict who may subscribe.** In `index.ts`, add an env var
   `ALLOWED_USERS` (comma-separated CouchDB usernames, default: `admin`). In `requireAuth`, after
   `validateSession` returns a username, reject with `403` if the username is not in the allowlist:

   ```ts
   const allowedUsers = (process.env.ALLOWED_USERS ?? 'admin')
     .split(',').map(s => s.trim()).filter(Boolean)
   ```

   This makes `sendToAll` equivalent to "send to the account's devices", which is the intended
   semantics ("all my devices get my reminders").
2. **Keep `sendToAll` in the scheduler** — with subscriptions restricted to one account it is
   correct (a user's phone *and* laptop should both get the snooze alert).
3. **Document the constraint.** Create `src/push-server/README.md` (or extend it if one exists)
   stating: the entire system (CouchDB DB + push server) is single-account; `ALLOWED_USERS` guards
   the push endpoints; multi-account support would require per-user databases and per-user
   scheduler scoping.
4. Optional hardening (do it, it's two lines): on startup, log a warning if
   `process.env.COUCH_PASSWORD` is empty — the server currently boots happily with blank admin
   credentials.

## Guardrails — read before editing

- Do not build per-user data filtering into the scanners — the data model cannot support it; you
  would be inventing ownership semantics that don't exist.
- Do not remove `userId` from `SubscriptionDoc` or the `sendToUser` function — daily reminders use
  it, and the allowlist approach keeps it meaningful.
- Existing subscription docs must keep working; the allowlist applies at request time only.
- CORS config in `index.ts` is unrelated — leave it alone.
- Coordinate with issues 008/009 (same files). If executing together, do 008 → 009 → 010.

## Acceptance criteria

- With `ALLOWED_USERS=admin`, a session for user `alice` gets `403` on
  `POST /api/push/subscribe`; `admin` still gets `201`.
- Unset `ALLOWED_USERS` behaves as `admin`-only.
- `cd src/push-server && npm run build` passes.
