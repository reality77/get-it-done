import cron from 'node-cron'
import { getAllSubscriptions, findDueSnoozedItems } from './couch.js'
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

export function startScheduler(): void {
  cron.schedule('* * * * *',  () => { void runDailyReminders() })
  cron.schedule('0 9 * * *', () => { void runSnoozeCheck() })
}
