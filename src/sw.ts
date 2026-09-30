/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
}

type BadgeNavigator = WorkerNavigator & {
  setAppBadge?: (n?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/** Ana ekran simgesindeki rozet = bildirim merkezinde duran Günce bildirimi sayısı */
async function syncBadge() {
  const nav = self.navigator as BadgeNavigator
  try {
    const n = (await self.registration.getNotifications()).length
    if (n) await nav.setAppBadge?.(n)
    else await nav.clearAppBadge?.()
  } catch {
    /* rozet desteklenmiyor */
  }
}

self.addEventListener('push', (event) => {
  let data: PushPayload
  try {
    data = event.data!.json()
  } catch {
    data = { title: 'Günce', body: event.data?.text() ?? '', url: '#/', tag: 'gunce' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      data: { url: data.url },
    }).then(syncBadge),
  )
})

// Bildirim kaydırılıp kapatılınca (tarayıcı bu olayı gönderiyorsa) rozeti güncelle
self.addEventListener('notificationclose', (event) => {
  event.waitUntil(syncBadge())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const hash: string = event.notification.data?.url ?? '#/'
  const target = new URL(self.registration.scope)
  target.hash = hash.replace(/^#/, '')
  event.waitUntil(
    (async () => {
      await syncBadge()
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const client = all.find((c) => c.url.startsWith(self.registration.scope))
      if (client) {
        await client.focus()
        client.postMessage({ type: 'navigate', hash })
        return
      }
      await self.clients.openWindow(target.href)
    })(),
  )
})
