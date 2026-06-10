# 017 — Batch of minor cleanups (dead code, small UX papercuts, dependencies)

| | |
|---|---|
| **Type** | Chore batch |
| **Severity** | Low |
| **Confidence** | High per item (each independently verified) |
| **Effort** | Small per item |

Execute items independently; each is safe alone. **Skip any item that conflicts with an issue file
that landed after this analysis** (noted per item). After each item:
`cd src/get-it-done && npm run build` must stay green.

## A. Duplicate PouchDB dependency

`src/get-it-done/package.json` depends on both `pouchdb` and `pouchdb-browser`. Source imports only
`pouchdb-browser` (one import in `lib/couchdb.ts`; types via `@types/pouchdb`). Remove the
`"pouchdb"` dependency (keep `pouchdb-browser`, keep both `@types/*` packages — `@types/pouchdb` is
the umbrella that provides the `PouchDB.*` namespaces used in type positions). Run `npm install`
to update the lockfile, then build.

## B. Unused export `HTTP_UNAUTHORIZED_STATUSES`

`src/get-it-done/src/config/constants.ts` exports `HTTP_UNAUTHORIZED_STATUSES = [401, 403]`;
nothing imports it. Either delete it, or (better) use it: `useSyncManager.ts` has a local
`isAuthError` checking `s === 401 || s === 403` — replace the literals with
`HTTP_UNAUTHORIZED_STATUSES.includes(s)` and keep the constant. Choose the "use it" option.
`lib/couchdb.ts` also hardcodes `401 || 403` twice (`couchGetSession`, `ensureDatabase`) — same
replacement there.

## C. Unused atoms

`TaskStatusDot.vue`, `EffortAvatar.vue`, `VChip.vue`, `VToggle.vue` are imported by nothing
(verify each with a grep for the name before deleting — the inventory may have changed). Delete
the confirmed-unused ones. Do **not** delete `VSegmented` (used by `SnoozeModal`, and issue 011
plans to use it).

## D. Dead template ref in `ChecklistCard.vue`

The root div has `ref="cardEl"` but no `cardEl` variable exists in the script. Remove the
attribute (the swipe target is `cardHeaderEl`, which is real).

## E. `DayPlanBar` shows a hardcoded "/ 5" that means nothing

`DayPlanBar.vue` defaults `maxCount: 5` and renders `{{ remaining }} / {{ maxCount }}`, but the
suggestion algorithm budgets **effort units** (`DAY_PLAN_EFFORT_BUDGET = 4` S-units), not item
count — a suggested day can legitimately contain 1 task (one L) or 5+ (mandatory deadline items
ignore the budget). Change the bar to drop the denominator: show `✓ {completedCount} · {remaining}
remaining` and make the progress bar fraction `completedCount / (completedCount + remaining)`
(guard divide-by-zero → 0%). Remove the now-unused `maxCount` prop **and** its usages (DayView
passes nothing extra today — verify). Keep emits unchanged.

## F. Misleading login error for non-cookie failures

`stores/auth.ts` maps `couchLogin`'s `'unauthorized'` (HTTP 401 = wrong password) to
"Session cookie was rejected. Ensure the app is served over HTTPS." while wrong passwords fall to
the generic else-branch only when the error message is something else. Read `couchLogin` in
`lib/couchdb.ts`: it throws `'unauthorized'` precisely on 401 — which for `POST /_session` means
**bad credentials**, not a cookie problem. Swap the texts: `'unauthorized'` → "Invalid password.
Please try again."; keep network/server branches; the final else becomes a generic "Login failed."
Also: `ensureDatabase` throwing `'unauthorized'` (403 = authenticated but not allowed to create
the DB) currently surfaces the same wrong message — give it its own error string `'forbidden'`
thrown from `ensureDatabase`, mapped to "Signed in, but this account cannot access the database."

## G. No logout affordance

`authStore.logout()` exists; no UI calls it. Add a "Log out" item to the `NotificationSettings`
modal? No — wrong place. Smallest honest fix: in `App.vue`'s header, the sync-status dot is the
only authenticated-state indicator; wrap it in a button that, on click, shows a tiny inline menu
(or `confirm()` dialog) offering "Log out" → `authStore.logout()`. Keep it minimal — a
`window.confirm('Log out?')` on dot-click is acceptable for now. After logout the existing watcher
in App.vue handles sync teardown; verify `loginPrompted` becomes true (the watcher sets it when
`wasAuthed`).

## H. Empty details panel toggle on bare cards

`TaskCard.vue`: since PR #66, **any** card click runs `handleCardClick`, which toggles
`displayDetails` — even when the card has no comment, no URL, and is not a checklist-task with
items. Clicking such a card expands an empty gray panel. Compute
`hasDetails` (`!!(item.comment || item.url || (isChecklistTask && checkListItems.length > 0))`)
and make `handleCardClick` a no-op when `hasDetails` is false (keep the `suppressNextClick`
long-press guard logic intact); additionally guard the panel with
`v-if="displayDetails && hasDetails"`. Do not change the long-press-opens-sheet behavior.

## I. `SnoozeMenu` outside-click listener leak window

`SnoozeMenu.vue` adds its document click listener inside `setTimeout(..., 0)`; if the component
unmounts within that same tick, `onUnmounted` runs before the listener was added → the listener is
added afterwards and never removed. Store the timeout id; in `onUnmounted`, `clearTimeout` it
**and** remove the listener (the existing `removeEventListener` line stays).

## J. Service worker `notificationclick` focuses an arbitrary client

`src/get-it-done/src/sw.ts`: the loop returns `client.focus()` for the **first** window client,
regardless of its URL, and `c?.navigate(url)` may navigate a non-app tab on the same origin. Match
properly: prefer a client whose `client.url` includes `'/get-it-done/'`; navigate only matched
clients; otherwise `openWindow(url)`. Also the `actions` array passed to `showNotification` is
dead weight (no `event.action` handling in `notificationclick`) — leave the actions plumbing in
place (the server may use it later) but add a one-line comment noting `event.action` is currently
unhandled.

## K. Inconsistent priority default in the snoozed-items sort

`useDayPlanning.ts` `snoozedItems` (added in PR #65) sorts with
`PRIORITY_ORDER[a.item.priority ?? 'secondary'] ?? 2`, while every other consumer in the codebase
defaults a missing priority to `'important'` (see `itemsByPriority`, `scoreItem`,
`suggestWeekPlan`). Change the two `?? 'secondary'` fallbacks in that sort to `?? 'important'`
(numeric fallback `?? 1`) so unprioritized items sort consistently everywhere. Note
`suggestWeekPlan` contains a nearly identical sort — leave it, or extract a shared
`compareBySnoozeDateThenPriority` helper if the diff stays small.

## Guardrails

- Items C and E intersect issue 011/012 — re-grep usages at execution time, don't trust this file's
  inventory.
- Item F touches login flow — test a wrong password and a successful login against a real CouchDB
  (`npm run dev` + the password prompt) if available; otherwise reason through the three throw
  sites in `lib/couchdb.ts` and say so in the PR description.
- No item here may change persisted document shapes.

## Acceptance criteria

- Build green after each item; final grep checks per item as described.
