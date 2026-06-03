import {
  runMonitor,
  runEventsPipeline,
  resolveCronRequest,
  ALL_CRON_SOURCE_IDS,
  CRON_BATCHES,
} from '../../scripts/monitor/run.mjs'

export const config = {
  maxDuration: 60,
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

function parseQuery(req) {
  const host = headerValue(req.headers, 'host') || 'localhost'
  const url = new URL(req.url ?? '/', `https://${host}`)
  return {
    source: url.searchParams.get('source'),
    batch: url.searchParams.get('batch'),
    pipeline: url.searchParams.get('pipeline'),
  }
}

function mapResults(results) {
  return results.map((r) => ({
    sourceId: r.sourceId,
    saved: r.hits ?? 0,
    skipped: Boolean(r.skipped),
    reason: r.reason ?? null,
    closedSkipped: r.stats?.closedSkipped ?? 0,
    aiSkipped: r.stats?.aiSkipped ?? 0,
    error: r.error ?? null,
  }))
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const auth = verifyAuth(req)
  if (!auth.ok) {
    return res.status(auth.status).json({ ok: false, error: auth.message })
  }

  const started = Date.now()
  const query = parseQuery(req)
  const resolved = resolveCronRequest(query)

  if (resolved.error) {
    return res.status(400).json({
      ok: false,
      error: resolved.error,
      knownSources: resolved.knownSources,
      batchCount: resolved.batchCount,
      batches: CRON_BATCHES.map((sources, i) => ({ batch: i, sources })),
    })
  }

  try {
    if (resolved.mode === 'pipeline') {
      const result = await runEventsPipeline(console)
      return res.status(200).json({
        ok: true,
        mode: 'pipeline',
        processed: result.processed,
        saved: result.saved,
        skipped: result.skipped,
        skippedSources: result.skippedSources,
        skippedHits: result.skippedHits,
        events: result.events,
        durationMs: Date.now() - started,
      })
    }

    const result = await runMonitor({
      sources: resolved.sources,
      batch: resolved.batch,
      runPipeline: resolved.runPipeline,
      runCleanup: resolved.runCleanup,
      logger: console,
    })

    return res.status(200).json({
      ok: true,
      mode: resolved.mode,
      batch: resolved.batch,
      sources: resolved.sources ?? ALL_CRON_SOURCE_IDS,
      processed: result.processed,
      processedCandidates: result.processedCandidates,
      saved: result.saved,
      skipped: result.skipped,
      skippedSources: result.skippedSources,
      skippedHits: result.skippedHits,
      pipeline: result.pipeline ?? null,
      events: result.events ?? null,
      durationMs: Date.now() - started,
      errors: result.errors.map((e) => ({ sourceId: e.sourceId, error: e.error })),
      results: mapResults(result.results),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('monitor cron failed:', message)
    return res.status(500).json({ ok: false, error: message, durationMs: Date.now() - started })
  }
}
