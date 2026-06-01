import { runMonitor } from '../../scripts/monitor/run.mjs'

export const config = {
  maxDuration: 300,
}

function getExpectedToken() {
  return (process.env.MONITOR_CRON_TOKEN || process.env.CRON_SECRET || '').trim()
}

function extractToken(request) {
  const url = new URL(request.url)
  const queryToken = url.searchParams.get('token')?.trim()
  if (queryToken) return queryToken

  const headerToken = request.headers.get('x-monitor-token')?.trim()
  if (headerToken) return headerToken

  const auth = request.headers.get('authorization')?.trim()
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }

  return null
}

function verifyAuth(request) {
  const expected = getExpectedToken()
  if (!expected) {
    return { ok: false, status: 503, message: 'MONITOR_CRON_TOKEN is not configured' }
  }

  const provided = extractToken(request)
  if (!provided || provided !== expected) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }

  return { ok: true }
}

export default async function handler(request) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const auth = verifyAuth(request)
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.message }, { status: auth.status })
  }

  try {
    const { saved, results, errors, sourceCount } = await runMonitor({ logger: console })
    return Response.json({
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
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
