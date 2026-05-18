import cron from 'node-cron'
import {
  getAllSubscriptions,
  findDueSnoozedItems,
  findDueTaskReminders,
  isReminderFired,
  markReminderFired,
} from './couch.js'
import { sendToUser, sendToAll } from './sender.js'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function currentHHMM(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// Runs every minute — sends daily planning reminder to users whose configured time matches now
async function runDailyReminders(): Promise<void> {
  const time = currentHHMM()
  const subs = await getAllSubscriptions()
  const userIds = [...new Set(
    subs.filter(s => s.dailyReminderTime === time).map(s => s.userId),
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

// Runs daily at 09:00 — notifies about snoozed tasks whose snoozeUntil date has arrived
async function runSnoozeCheck(): Promise<void> {
  const today = todayDate()
  const due = await findDueSnoozedItems(today)
  if (due.length === 0) return

  const title = due.length === 1 ? 'Snooze ended' : `${due.length} snoozes ended`
  const body  = due.length === 1
    ? `"${due[0].text}" is ready for you.`
    : `${due.length} snoozed tasks are ready for your review.`

  await sendToAll({ title, body, url: '/get-it-done/#day' })
}

// Runs every minute — fires push notifications for due task reminders
async function runTaskReminders(): Promise<void> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - 60_000)
  const due = await findDueTaskReminders(windowStart, now)
  for (const { checklistId, itemId, text, reminderAt } of due) {
    if (await isReminderFired(checklistId, itemId, reminderAt)) continue
    await sendToAll({ title: '⏰ Reminder', body: text, url: '/get-it-done/#day' })
    await markReminderFired(checklistId, itemId, reminderAt)
  }
}

export function startScheduler(): void {
  cron.schedule('* * * * *',  () => { void runDailyReminders() })
  cron.schedule('* * * * *',  () => { void runTaskReminders() })
  cron.schedule('0 9 * * *', () => { void runSnoozeCheck() })
}
