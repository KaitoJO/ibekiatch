const API_BASE = ''

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    return null
  }
}

async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/push/vapid-public-key`)
  if (!res.ok) {
    throw new Error('VAPID 公開鍵を取得できません')
  }
  const data = (await res.json()) as { publicKey?: string }
  if (!data.publicKey) throw new Error('VAPID 公開鍵が未設定です')
  return data.publicKey
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function getPushSubscriptionState(): Promise<'unsupported' | 'denied' | 'prompt' | 'subscribed'> {
  if (!isWebPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration('/')
  if (!reg) return 'prompt'
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'subscribed' : 'prompt'
}

export async function subscribeWebPush(accessToken: string): Promise<void> {
  if (!isWebPushSupported()) {
    throw new Error('このブラウザは Web Push に対応していません')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('通知の許可が必要です')
  }

  const registration = (await navigator.serviceWorker.getRegistration('/')) ?? (await registerServiceWorker())
  if (!registration) {
    throw new Error('Service Worker を登録できませんでした')
  }

  await navigator.serviceWorker.ready

  const publicKey = await fetchVapidPublicKey()
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }))

  const res = await fetch(`${API_BASE}/api/push/subscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? '購読の保存に失敗しました')
  }
}

export async function unsubscribeWebPush(accessToken: string): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = registration ? await registration.pushManager.getSubscription() : null

  if (subscription) {
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    await fetch(`${API_BASE}/api/push/unsubscribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint }),
    })
  }
}
