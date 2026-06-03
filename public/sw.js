/* eslint-disable no-restricted-globals */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = { title: 'イベキャッチ', body: '新着イベントがあります' }
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() }
    }
  } catch {
    // keep defaults
  }

  const title = payload.title || 'イベキャッチ'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons.svg',
    badge: payload.badge || '/icons.svg',
    data: payload.data || { url: '/?tab=home' },
    tag: payload.data?.eventId ? `event-${payload.data.eventId}` : 'new-event',
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/?tab=home'
  const absolute = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(absolute)
      }
      return undefined
    }),
  )
})
