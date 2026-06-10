# 009 — Push scheduler: server-local time assumptions and a 60-second loss window

| | |
|---|---|
| **Type** | Bug |
| **Severity** | Medium |
| **Confidence** | High |
| **Effort** | Medium |
| **Files** | `src/push-server/src/scheduler.ts`, `src/push-server/src/index.ts`, `src/push-server/src/couch.ts` (SubscriptionDoc), `src/get-it-done/src/composables/useNotifications.ts` (one small addition) |

## Problems (three distinct ones in `scheduler.ts`)

### A. Daily reminder compares client-local HH:MM against server-local HH:MM

The client stores a `<input type="time">` value — the **user's local** "08:00" — and POSTs it as
`dailyReminderTime`. The scheduler matches it against the **server's** clock:

```ts
function currentHHMM(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
...
subs.filter(s => s.dailyReminderTime === time)
```

If the server runs in UTC (typical container) and the user is at UTC+2, the "08:00" reminder
arrives at 10:00 local.

### B. Reminder scan window is exactly one cron tick — restarts drop reminders

```ts
const windowStart = new Date(now.getTime() - 60_000)
const due = await findDueTaskReminders(windowStart, now)
```

If the server restarts, a cron tick is delayed, or the event loop stalls past one minute, reminders
falling in the gap are **silently lost forever** — even though the `push_fired_reminders` DB exists
precisely to deduplicate re-scans.

### C. Snooze check uses UTC day and a server-local 09:00

`todayDate()` is `toISOString().slice(0, 10)` (UTC day) and `cron.schedule('0 9 * * *', ...)` is
server-local 09:00. Both should follow the user's timezone.

## Fix

### Step 1 — capture the user's IANA timezone at subscribe time

1. Client (`src/get-it-done/src/composables/useNotifications.ts`): in `postSubscription`, add
   `timezone: Intl.DateTimeFormat().resolvedOptions().timeZone` to the JSON body.
2. Server (`index.ts`): extend `SubscribeBody` with `timezone?: string`; pass it through
   `handleSubscribe` → `saveSubscription`.
3. Server (`couch.ts`): add `timezone: string | null` to `SubscriptionDoc`; `saveSubscription`
   gains a `timezone: string | null` parameter and stores it. Existing subscription docs without
   the field must keep working (treat missing as `null`).

### Step 2 — evaluate times in the subscription's timezone

In `scheduler.ts`, add a helper:

```ts
function hhmmInZone(d: Date, timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timeZone ?? undefined,
    }).format(d)
  } catch {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}
```

`runDailyReminders` then filters per subscription:
`subs.filter(s => s.dailyReminderTime && s.dailyReminderTime === hhmmInZone(now, s.timezone))`.
(The `try/catch` guards against a stored garbage timezone string — `Intl` throws on invalid zones.)

Equivalent helper `dateInZone(d, tz)` using `en-CA` locale (`YYYY-MM-DD` format) replaces
`todayDate()` for the snooze check.

### Step 3 — make the snooze check per-user-timezone 09:00

Replace the `'0 9 * * *'` cron with logic inside the every-minute tick (or a separate every-minute
job): for each distinct timezone among subscriptions, if `hhmmInZone(now, tz) === '09:00'`, run the
snooze scan with `today = dateInZone(now, tz)` and send the result to the subscriptions in that
timezone (via `sendToUser`-style filtering — see issue 010 about who receives what; if 010 is not
yet done, sending to the subscriptions whose timezone matched is the correct scope here).
Deduplication: a per-process `Set` keyed `"snooze:<tz>:<date>"` is enough to prevent double-fires
within the same minute.

### Step 4 — widen the reminder window and rely on dedup

In `runTaskReminders`, change the look-back from 60 s to 15 minutes:

```ts
const windowStart = new Date(now.getTime() - 15 * 60_000)
```

`isReminderFired`/`markReminderFired` already deduplicate, so widening the window only adds cheap
re-checks and recovers reminders across restarts ≤ 15 min. Reminders are absolute UTC instants —
**no timezone change is needed for them**.

## Guardrails — read before editing

- **Reminders (`item.reminders`) are absolute ISO timestamps. Do not apply timezone conversion to
  them.** Only `dailyReminderTime` (wall-clock HH:MM) and `snoozeUntil` (calendar day) are
  timezone-sensitive.
- Do not introduce a timezone library (luxon/dayjs). `Intl.DateTimeFormat` with `timeZone` covers
  everything needed and is built into Node ≥ 14.
- Existing subscriptions have no `timezone` field — every code path must tolerate `null`/missing
  (fallback: server-local, i.e. current behavior).
- Do not change the client's `dailyReminderTime` storage format (plain `HH:MM`).
- Do not modify the scanners' item/doc traversal logic here — that is issue 008. If 008 has landed,
  rebase on it; if not, leave `findDueSnoozedItems`'s traversal as-is and only thread the
  `today` parameter.
- The web app build must also still pass (`cd src/get-it-done && npm run build`) since
  `useNotifications.ts` changes.

## Acceptance criteria

- A subscription stored with `timezone: "Europe/Paris"`, `dailyReminderTime: "08:00"`: the daily
  push fires when it is 08:00 in Paris regardless of server TZ (simulate by setting `TZ=UTC` for
  the server process and faking `now`, or by temporarily logging `hhmmInZone` matches).
- Restart the server 5 minutes after a reminder's timestamp: the reminder still fires once, exactly
  once (fired-marker dedup).
- Subscriptions without `timezone` behave as before (server-local matching).
- `cd src/push-server && npm run build` and `cd src/get-it-done && npm run build` both pass.
