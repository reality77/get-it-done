/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[]
}

// Injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── Push payload shape ────────────────────────────────────────────────────────

interface PushPayload {
  title?: string
  body?: string
  url?: string
  actions?: { action: string; title: string }[]
}

// ── Push received (fires even when app is closed) ─────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data: PushPayload
  try {
    data = event.data.json() as PushPayload
  } catch {
    const text = event.data.text()
    if (!text) return
    data = { title: 'Get It Done', body: text, url: '/get-it-done/' }
  }

  const title = data.title || 'Get It Done'
  const body  = data.body  || ''
  const url   = data.url   || '/get-it-done/'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/get-it-done/pwa-192x192.png',
      badge: '/get-it-done/pwa-192x192.png',
      data: { url },
      actions: data.actions ?? [],
    } as NotificationOptions),
  )
})

// ── Notification tapped ───────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url: string = (event.notification.data as { url: string })?.url ?? '/get-it-done/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus().then((c) => c?.navigate(url))
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(url)
      }),
  )
})
