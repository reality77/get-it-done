/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

// Injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── Push payload shape ────────────────────────────────────────────────────────

interface PushPayload {
  title: string
  body: string
  url: string
  actions?: { action: string; title: string }[]
}

// ── Push received (fires even when app is closed) ─────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json() as PushPayload

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/get-it-done/pwa-192x192.png',
      badge: '/get-it-done/pwa-192x192.png',
      data: { url: data.url ?? '/get-it-done/' },
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
