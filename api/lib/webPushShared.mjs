import webpush from 'web-push'
import { loadEnv, requireEnv } from './env.mjs'

let configured = false

export function getVapidPublicKey() {
  const env = loadEnv()
  return env.VAPID_PUBLIC_KEY?.trim() ?? ''
}

export function configureWebPush() {
  if (configured) return
  const env = loadEnv()
  const publicKey = requireEnv(env, 'VAPID_PUBLIC_KEY')
  const privateKey = requireEnv(env, 'VAPID_PRIVATE_KEY')
  const subject = env.VAPID_SUBJECT?.trim() || 'mailto:support@ibekiatch.vercel.app'
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

function formatShortDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** @param {{ title: string, location?: string, area?: string, recruit_end?: string | null, id?: string }} event */
export function formatEventPushPayload(event) {
  const place = event.location || event.area || '場所要確認'
  const deadline = event.recruit_end
    ? `締切 ${formatShortDate(event.recruit_end)}`
    : '締切未定'

  return {
    title: '新着イベント',
    body: `${event.title}\n${place} · ${deadline}`,
    icon: '/icons.svg',
    badge: '/icons.svg',
    data: {
      url: '/?tab=home',
      eventId: event.id ?? null,
    },
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} event
 * @param {{ log?: Function, warn?: Function }} logger
 */
export async function notifyNewEventPush(supabase, event, logger = console) {
  const publicKey = getVapidPublicKey()
  if (!publicKey) {
    logger.warn?.('[push] VAPID_PUBLIC_KEY not set — skip')
    return { sent: 0, failed: 0, skipped: true }
  }

  configureWebPush()

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')

  if (error) {
    logger.warn?.('[push] load subscriptions:', error.message)
    return { sent: 0, failed: 0, error: error.message }
  }
  if (!subs?.length) {
    return { sent: 0, failed: 0 }
  }

  const payload = JSON.stringify(formatEventPushPayload(event))
  let sent = 0
  let failed = 0

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      )
      sent++
    } catch (err) {
      failed++
      const status = err?.statusCode
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
      logger.warn?.('[push] send failed:', status ?? err?.message)
    }
  }

  if (sent > 0) {
    logger.log?.(`[push] notified ${sent} device(s) for "${event.title?.slice(0, 40)}"`)
  }

  return { sent, failed }
}
