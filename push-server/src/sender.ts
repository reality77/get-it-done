import webpush from 'web-push'
import { getAllSubscriptions, deleteSubscription } from './couch.js'
import type { PushSubscription, SubscriptionDoc } from './couch.js'

export interface PushPayload {
  title: string
  body: string
  url: string
  actions?: { action: string; title: string }[]
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT      ?? 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY   ?? '',
  process.env.VAPID_PRIVATE_KEY  ?? '',
)

async function sendOne(sub: SubscriptionDoc, payload: PushPayload): Promise<void> {
  try {
    await webpush.sendNotification(
      sub.subscription as webpush.PushSubscription,
      JSON.stringify(payload),
    )
  } catch (e) {
    // 410 Gone = subscription no longer valid; remove it
    if (e && typeof e === 'object' && 'statusCode' in e && (e as { statusCode: number }).statusCode === 410) {
      await deleteSubscription(sub.userId, sub.subscription.endpoint)
    }
  }
}

export async function sendToAll(payload: PushPayload): Promise<void> {
  const subs = await getAllSubscriptions()
  await Promise.all(subs.map(s => sendOne(s, payload)))
}

export async function sendToUser(userId: string, payload: PushPayload): Promise<void> {
  const all = await getAllSubscriptions()
  await Promise.all(all.filter(s => s.userId === userId).map(s => sendOne(s, payload)))
}

export async function sendToSubscription(sub: PushSubscription, payload: PushPayload): Promise<void> {
  const fake: SubscriptionDoc = {
    _id: '', userId: '', subscription: sub,
    dailyReminderTime: null, createdAt: '', updatedAt: '',
  }
  await sendOne(fake, payload)
}
