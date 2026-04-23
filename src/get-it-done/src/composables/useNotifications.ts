import { ref, computed } from 'vue'

const PUSH_SERVER_URL = (import.meta.env.VITE_PUSH_SERVER_URL as string | undefined) ?? 'http://localhost:3000'
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

const STORAGE_SUBSCRIBED = 'push_subscribed'
const STORAGE_REMINDER   = 'push_reminder_time'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buf = new ArrayBuffer(raw.length)
  const arr = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function postSubscription(sub: PushSubscription, reminderTime: string | null): Promise<void> {
  const res = await fetch(`${PUSH_SERVER_URL}/api/push/subscribe`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), dailyReminderTime: reminderTime || null }),
  })
  if (!res.ok) throw new Error(`Server error ${res.status}`)
}

export function useNotifications() {
  const supported = typeof window !== 'undefined'
    && 'PushManager' in window
    && 'serviceWorker' in navigator

  const permission = ref<NotificationPermission>(
    supported ? Notification.permission : 'denied',
  )
  const isSubscribed     = ref(localStorage.getItem(STORAGE_SUBSCRIBED) === '1')
  const dailyReminderTime = ref(localStorage.getItem(STORAGE_REMINDER) ?? '')
  const loading = ref(false)
  const error   = ref<string | null>(null)

  const denied = computed(() => permission.value === 'denied')

  async function subscribe(): Promise<void> {
    if (!supported || loading.value) return
    error.value = null
    loading.value = true
    try {
      const perm = await Notification.requestPermission()
      permission.value = perm
      if (perm !== 'granted') {
        error.value = 'Notification permission was not granted.'
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      await postSubscription(sub, dailyReminderTime.value)
      localStorage.setItem(STORAGE_SUBSCRIBED, '1')
      isSubscribed.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to enable notifications.'
    } finally {
      loading.value = false
    }
  }

  async function unsubscribe(): Promise<void> {
    if (!supported || loading.value) return
    error.value = null
    loading.value = true
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch(`${PUSH_SERVER_URL}/api/push/subscribe`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      localStorage.removeItem(STORAGE_SUBSCRIBED)
      isSubscribed.value = false
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to disable notifications.'
    } finally {
      loading.value = false
    }
  }

  async function updateReminderTime(time: string): Promise<void> {
    dailyReminderTime.value = time
    if (time) localStorage.setItem(STORAGE_REMINDER, time)
    else localStorage.removeItem(STORAGE_REMINDER)

    if (!isSubscribed.value) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await postSubscription(sub, time)
    } catch {
      // non-fatal — time is persisted locally, will sync on next subscribe
    }
  }

  return {
    supported,
    permission,
    isSubscribed,
    dailyReminderTime,
    loading,
    error,
    denied,
    subscribe,
    unsubscribe,
    updateReminderTime,
  }
}
