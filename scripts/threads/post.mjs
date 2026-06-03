import { getAdminSupabase, parseEnvFile } from '../monitor/lib.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const SLOT_HASHTAGS = '#キッチンカー #出店募集 #イベキャッチ #三重 #フリマ #マルシェ'
const THREADS_API = 'https://graph.threads.net/v1.0'

function getEnv() {
  const fileEnv = parseEnvFile(resolve(root, '.env'))
  const userId = (fileEnv.THREADS_USER_ID || process.env.THREADS_USER_ID || '').trim()
  const token = (fileEnv.THREADS_ACCESS_TOKEN || process.env.THREADS_ACCESS_TOKEN || '').trim()
  if (!userId || !token) {
    throw new Error('THREADS_USER_ID と THREADS_ACCESS_TOKEN が必要です（.env または環境変数）')
  }
  return { userId, token }
}

export function pickSlot(date = new Date()) {
  const jstHour = (date.getUTCHours() + 9) % 24
  if (jstHour < 11) return 'morning'
  if (jstHour < 18) return 'noon'
  return 'night'
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function buildPostText(event, slot) {
  const intro = {
    morning: '☀️ 今朝の出店募集',
    noon: '🍱 お昼の出店募集',
    night: '🌙 今夜の出店募集',
  }[slot] ?? '📣 出店募集'

  const date = formatDate(event.event_date)
  const location = (event.location || event.area || '').slice(0, 40)
  const title = (event.title || '').slice(0, 60)

  const lines = [
    intro,
    title,
    date ? `📅 ${date}` : null,
    location ? `📍 ${location}` : null,
    event.fee ? `💴 ${String(event.fee).slice(0, 30)}` : null,
    '👉 ibekiatch.vercel.app',
    SLOT_HASHTAGS,
  ].filter(Boolean)

  let text = lines.join('\n')
  if (text.length > 480) text = text.slice(0, 477) + '...'
  return text
}

async function fetchLatestEvent(supabase) {
  const { data: posted } = await supabase
    .from('threads_posts')
    .select('event_id')
    .eq('status', 'posted')
    .not('event_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(200)

  const postedIds = new Set((posted ?? []).map((r) => r.event_id))

  const { data, error } = await supabase
    .from('events')
    .select('id,title,location,area,event_date,fee,source_url')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data ?? []).find((e) => !postedIds.has(e.id)) ?? null
}

async function postToThreads({ userId, token, text }) {
  const createUrl = `${THREADS_API}/${userId}/threads?media_type=TEXT&text=${encodeURIComponent(text)}&access_token=${token}`
  const createRes = await fetch(createUrl, { method: 'POST' })
  if (!createRes.ok) {
    throw new Error(`create container failed: HTTP ${createRes.status} ${await createRes.text()}`)
  }
  const { id: containerId } = await createRes.json()

  const publishUrl = `${THREADS_API}/${userId}/threads_publish?creation_id=${containerId}&access_token=${token}`
  const pubRes = await fetch(publishUrl, { method: 'POST' })
  if (!pubRes.ok) {
    throw new Error(`publish failed: HTTP ${pubRes.status} ${await pubRes.text()}`)
  }
  const pubJson = await pubRes.json()
  return pubJson.id
}

export async function runThreadsPost({ logger = console, dryRun = false } = {}) {
  const supabase = getAdminSupabase()
  const slot = pickSlot()

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { data: alreadyPosted } = await supabase
    .from('threads_posts')
    .select('id')
    .eq('slot', slot)
    .eq('status', 'posted')
    .gte('posted_at', todayStart.toISOString())
    .limit(1)

  if (alreadyPosted && alreadyPosted.length > 0) {
    logger.log(`[threads] slot=${slot} は本日投稿済みのためスキップ`)
    return { skipped: true, slot }
  }

  const event = await fetchLatestEvent(supabase)
  if (!event) {
    logger.log('[threads] 投稿対象イベントなし')
    await supabase.from('threads_posts').insert({
      slot,
      text: '(no event)',
      status: 'skipped',
    })
    return { skipped: true, slot, reason: 'no_event' }
  }

  const text = buildPostText(event, slot)
  logger.log(`[threads] slot=${slot} event=${event.id} text=\n${text}`)

  if (dryRun) {
    return { dryRun: true, slot, eventId: event.id, text }
  }

  const env = getEnv()
  try {
    const threadId = await postToThreads({ userId: env.userId, token: env.token, text })
    await supabase.from('threads_posts').insert({
      event_id: event.id,
      slot,
      text,
      thread_id: threadId,
      status: 'posted',
    })
    logger.log(`[threads] 投稿成功 thread_id=${threadId}`)
    return { ok: true, slot, eventId: event.id, threadId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[threads] 投稿失敗: ${message}`)
    await supabase.from('threads_posts').insert({
      event_id: event.id,
      slot,
      text,
      status: 'failed',
      error: message,
    })
    throw err
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run')
  runThreadsPost({ dryRun })
    .then((r) => {
      console.log('result:', r)
      process.exit(0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
