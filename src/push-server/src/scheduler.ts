import cron from 'node-cron'
import {
  getAllSubscriptions,
  findDueSnoozedItems,
  findDueTaskReminders,
  isReminderFired,
  markReminderFired,
} from './couch.js'
import type { SubscriptionDoc } from './couch.js'
import { sendToUser, sendToAll, sendToSubscriptions } from './sender.js'

// Wall-clock HH:MM (24h) in the given IANA timezone. Falls back to server-local
// time when the timezone is missing or invalid (Intl throws on garbage zones).
function hhmmInZone(d: Date, timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timeZone ?? undefined,
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

// Per-process dedup for snooze fires, keyed "snooze:<tz>:<date>".
const firedSnoozeChecks = new Set<string>()

// Runs every minute — sends daily planning reminder to subscriptions whose
// configured time matches the current wall-clock time in their own timezone.
async function runDailyReminders(): Promise<void> {
  const now = new Date()
  const subs = await getAllSubscriptions()
  const userIds = [...new Set(
    subs
      .filter(s => s.dailyReminderTime && s.dailyReminderTime === hhmmInZone(now, s.timezone ?? null))
      .map(s => s.userId),
  )]
  await Promise.all(
    userIds.map(userId =>
      sendToUser(userId, {
        title: 'Plan your day',
        body: 'Your tasks are waiting — take a moment to plan.',
        url: '/get-it-done/#day',
      }),
    ),
  )
}

// Runs every minute — for each distinct subscription timezone that is currently
// at 09:00 local, scans for snoozed tasks due that day and notifies the matching
// subscriptions. A per-process Set prevents double-fires within the same minute.
async function runSnoozeCheck(): Promise<void> {
  const now = new Date()
  const subs = await getAllSubscriptions()
  const zones = [...new Set(subs.map(s => s.timezone ?? null))]

  for (const tz of zones) {
    if (hhmmInZone(now, tz) !== '09:00') continue
    const today = dateInZone(now, tz)
    const key = `snooze:${tz ?? 'server-local'}:${today}`
    if (firedSnoozeChecks.has(key)) continue
    firedSnoozeChecks.add(key)

    const due = await findDueSnoozedItems(today)
    if (due.length === 0) continue

    const title = due.length === 1 ? 'Snooze ended' : `${due.length} snoozes ended`
    const first = due[0]
    const body  = due.length === 1 && first
      ? `"${first.text}" is ready for you.`
      : `${due.length} snoozed tasks are ready for your review.`

    const recipients = subs.filter((s: SubscriptionDoc) => (s.timezone ?? null) === tz)
    await sendToSubscriptions(recipients, { title, body, url: '/get-it-done/#day' })
  }
}

// Runs every minute — fires push notifications for due task reminders.
// The look-back window is 15 minutes so reminders survive restarts / stalls;
// isReminderFired/markReminderFired dedupe the cheap re-scans. Reminders are
// absolute UTC instants, so no timezone conversion is applied to them.
async function runTaskReminders(): Promise<void> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - 15 * 60_000)
  const due = await findDueTaskReminders(windowStart, now)
  for (const { checklistId, itemId, text, reminderAt } of due) {
    if (await isReminderFired(checklistId, itemId, reminderAt)) continue
    await sendToAll({ title: '⏰ Reminder', body: text, url: '/get-it-done/#day' })
    await markReminderFired(checklistId, itemId, reminderAt)
  }
}

export function startScheduler(): void {
  cron.schedule('* * * * *', () => { void runDailyReminders() })
  cron.schedule('* * * * *', () => { void runTaskReminders() })
  cron.schedule('* * * * *', () => { void runSnoozeCheck() })
}
