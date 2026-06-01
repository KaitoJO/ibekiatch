import { runMonitor } from '../../scripts/monitor/run.mjs'

export const config = {
  maxDuration: 300,
}

function getAllowedTokens() {
  return [process.env.MONITOR_CRON_TOKEN, process.env.CRON_SECRET]
    .map((t) => t?.trim())
    .filter(Boolean)
}

function headerValue(headers, name) {
  const value = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0]?.trim()
  return value?.trim()
}

function extractToken(req) {
  const host = headerValue(req.headers, 'host') || 'localhost'
  const url = new URL(req.url ?? '/', `https://${host}`)
  const queryToken = url.searchParams.get('token')?.trim()
  if (queryToken) return queryToken

  const headerToken = headerValue(req.headers, 'x-monitor-token')
  if (headerToken) return headerToken

  const auth = headerValue(req.headers, 'authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }

  return null
}

function verifyAuth(req) {
  const allowed = getAllowedTokens()
  if (allowed.length === 0) {
    return { ok: false, status: 503, message: 'MONITOR_CRON_TOKEN is not configured' }
  }

  const provided = extractToken(req)
  if (!provided || !allowed.includes(provided)) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }

  return { ok: true }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const auth = verifyAuth(req)
  if (!auth.ok) {
    return res.status(auth.status).json({ ok: false, error: auth.message })
  }

  try {
    const { saved, results, errors, sourceCount } = await runMonitor({ logger: console })
    return res.status(200).json({
      ok: true,
      saved,
      sourceCount,
      errors: errors.map((e) => ({ sourceId: e.sourceId, error: e.error })),
      results: results.map((r) => ({
        sourceId: r.sourceId,
        hits: r.hits ?? 0,
        skipped: r.skipped ?? false,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('monitor cron failed:', message)
    return res.status(500).json({ ok: false, error: message })
  }
}
