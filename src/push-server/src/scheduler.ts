import cron from 'node-cron'
import {
  getAllSubscriptions,
  findDueSnoozedItems,
  findDueTaskReminders,
  isReminderFired,
  markReminderFired,
} from './couch.js'
import type { SubscriptionDoc } from './couch.js'
import { sendToAll, sendToSubscriptions } from './sender.js'

// Wall-clock HH:MM (24h) in the given IANA timezone. Falls back to server-local
// time when the timezone is missing or invalid (Intl throws on garbage zones).
function hhmmInZone(d: Date, timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timeZone ?? undefined,
    }).format(d)
  } catch {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}

// Calendar day (YYYY-MM-DD) in the given IANA timezone. Falls back to server-local
// day when the timezone is missing or invalid.
function dateInZone(d: Date, timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timeZone ?? undefined,
    }).format(d)
  } catch {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
}

// Per-process dedup for snooze fires. Bounded by the number of distinct zones:
// maps a zone key to the last calendar date its 09:00 snooze push fired.
const lastSnoozeFireByZone = new Map<string, string>()

// Sends the daily planning reminder to exactly those subscriptions whose
// configured time matches the current wall-clock time in their own timezone.
// Delivers to the matched subscriptions directly so other devices of the same
// user (in different zones / with a different reminder time) are not notified.
async function runDailyReminders(subs: SubscriptionDoc[], now: Date): Promise<void> {
  const recipients = subs.filter(
    s => s.dailyReminderTime && s.dailyReminderTime === hhmmInZone(now, s.timezone ?? null),
  )
  if (recipients.length === 0) return
  await sendToSubscriptions(recipients, {
    title: 'Plan your day',
    body: 'Your tasks are waiting — take a moment to plan.',
    url: '/get-it-done/#day',
  })
}

// For each distinct subscription timezone that is currently at 09:00 local,
// scans for snoozed tasks due that day and notifies the matching subscriptions.
// The zone is recorded as fired for the day only AFTER the scan (and any send)
// succeed, so a transient CouchDB failure retries on the next minute instead of
// suppressing the push for the whole day. A successful zero-due scan still counts
// as done. Each zone is isolated so one zone's failure never blocks the others.
async function runSnoozeCheck(subs: SubscriptionDoc[], now: Date): Promise<void> {
  const zones = [...new Set(subs.map(s => s.timezone ?? null))]

  for (const tz of zones) {
    if (hhmmInZone(now, tz) !== '09:00') continue
    const today = dateInZone(now, tz)
    const zoneKey = tz ?? 'server-local'
    if (lastSnoozeFireByZone.get(zoneKey) === today) continue

    try {
      const due = await findDueSnoozedItems(today)

      if (due.length > 0) {
        const title = due.length === 1 ? 'Snooze ended' : `${due.length} snoozes ended`
        const first = due[0]
        const body  = due.length === 1 && first
          ? `"${first.text}" is ready for you.`
          : `${due.length} snoozed tasks are ready for your review.`

        const recipients = subs.filter((s: SubscriptionDoc) => (s.timezone ?? null) === tz)
        await sendToSubscriptions(recipients, { title, body, url: '/get-it-done/#day' })
      }

      // Mark done only after the scan (and send, if any) succeeded.
      lastSnoozeFireByZone.set(zoneKey, today)
    } catch (err) {
      console.error(`snooze check failed for zone ${zoneKey}`, err)
    }
  }
}

// Fires push notifications for due task reminders.
// The look-back window is 15 minutes so reminders survive restarts / stalls;
// isReminderFired/markReminderFired dedupe the cheap re-scans. Reminders are
// absolute UTC instants, so no timezone conversion is applied to them.
async function runTaskReminders(now: Date): Promise<void> {
  const windowStart = new Date(now.getTime() - 15 * 60_000)
  const due = await findDueTaskReminders(windowStart, now)
  for (const { checklistId, itemId, text, reminderAt } of due) {
    if (await isReminderFired(checklistId, itemId, reminderAt)) continue
    await sendToAll({ title: '⏰ Reminder', body: text, url: '/get-it-done/#day' })
    await markReminderFired(checklistId, itemId, reminderAt)
  }
}

// Single every-minute tick: fetch subscriptions once and share them across the
// daily-reminder and snooze checks. Each of the three jobs is wrapped in its own
// try/catch so a failure in one never aborts the others and no rejection escapes.
async function tick(): Promise<void> {
  const now = new Date()

  let subs: SubscriptionDoc[] = []
  try {
    subs = await getAllSubscriptions()
  } catch (err) {
    console.error('tick: failed to fetch subscriptions', err)
  }

  try {
    await runDailyReminders(subs, now)
  } catch (err) {
    console.error('tick: runDailyReminders failed', err)
  }

  try {
    await runSnoozeCheck(subs, now)
  } catch (err) {
    console.error('tick: runSnoozeCheck failed', err)
  }

  try {
    await runTaskReminders(now)
  } catch (err) {
    console.error('tick: runTaskReminders failed', err)
  }
}

export function startScheduler(): void {
  cron.schedule('* * * * *', () => { void tick() })
}
