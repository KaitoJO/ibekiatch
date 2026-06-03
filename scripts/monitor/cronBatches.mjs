import { isExcludedNewsSource } from './excludedSources.mjs'
import { PLAYWRIGHT_SOCIAL_SOURCES } from './config.mjs'

export { EXCLUDED_NEWS_SOURCE_IDS, EXCLUDED_NEWS_SOURCE_SET, isExcludedNewsSource } from './excludedSources.mjs'

/**
 * cron-job.org 用: 1リクエストあたり1〜2ソース（~30秒目安）
 * 重いソースは単独、静的ページは2つずつ
 */
export const CRON_BATCHES = [
  ['kokuchiz'],
  ['peatix'],
  ['jmty'],
  ['eventbank'],
  ['mie_cities'],
  ['shokokai', 'michinoeki'],
  ['maipure_mie'],
  ['mellow_shopstop', 'mobimaru'],
  ['kitchencar_madoguchi', 'aeon_mall'],
  ['outlet_mall', 'mie_tourism'],
  ['ja_mie'],
  ['twitter'],
  ['instagram'],
]

export const ALL_CRON_SOURCE_IDS = [...new Set(CRON_BATCHES.flat())]

export function isKnownSourceId(sourceId) {
  if (isExcludedNewsSource(sourceId)) return false
  return ALL_CRON_SOURCE_IDS.includes(sourceId)
}

export function getBatchSources(batchIndex) {
  if (!Number.isInteger(batchIndex) || batchIndex < 0 || batchIndex >= CRON_BATCHES.length) {
    return null
  }
  return CRON_BATCHES[batchIndex]
}

/**
 * @param {{ source?: string | null, batch?: string | null, pipeline?: string | null }} query
 */
export function resolveCronRequest(query = {}) {
  const pipeline = query.pipeline?.trim() ?? ''

  if (pipeline === 'events') {
    return { mode: 'pipeline', sources: [], batch: null, runPipeline: true, runCleanup: false }
  }

  const source = query.source?.trim()
  if (source) {
    if (isExcludedNewsSource(source)) {
      return { error: `Excluded news source: ${source}` }
    }
    if (!isKnownSourceId(source)) {
      return { error: `Unknown source: ${source}`, knownSources: ALL_CRON_SOURCE_IDS }
    }
    return {
      mode: 'source',
      sources: [source],
      batch: null,
      runPipeline: pipeline === '1' || pipeline === 'true',
      runCleanup: source === CRON_BATCHES[0][0],
    }
  }

  const batchRaw = query.batch?.trim()
  if (batchRaw !== undefined && batchRaw !== null && batchRaw !== '') {
    const batchIndex = Number.parseInt(batchRaw, 10)
    const sources = getBatchSources(batchIndex)
    if (!sources) {
      return {
        error: `Invalid batch index: ${batchRaw} (use 0-${CRON_BATCHES.length - 1})`,
        batchCount: CRON_BATCHES.length,
      }
    }
    return {
      mode: 'batch',
      sources,
      batch: batchIndex,
      runPipeline: pipeline === '1' || pipeline === 'true',
      runCleanup: batchIndex === 0,
    }
  }

  return {
    mode: 'all',
    sources: null,
    batch: null,
    runPipeline: pipeline === '1' || pipeline === 'true' || pipeline === '',
    runCleanup: true,
  }
}

export function buildCronJobUrls(baseUrl, token) {
  const origin = baseUrl.replace(/\/+$/, '')
  const q = token ? `?token=${encodeURIComponent(token)}` : '?token=YOUR_TOKEN'
  const sep = q.includes('?') ? '&' : '?'

  const urls = CRON_BATCHES.map((sources, index) => ({
    label: `batch ${index}: ${sources.join(' + ')}`,
    schedule: 'Every hour (stagger +0–14 min recommended)',
    url: `${origin}/api/cron/monitor${q}${sep}batch=${index}`,
  }))

  urls.push({
    label: 'events pipeline (AI → events テーブル)',
    schedule: 'Every hour at :15 (収集バッチの後)',
    url: `${origin}/api/cron/monitor${q}${sep}pipeline=events`,
  })

  return urls
}

export function formatCronJobUrlList(baseUrl, token) {
  const lines = [
    '# cron-job.org — ibekiatch 監視（1ジョブ = 1〜2ソース、~30秒）',
    `# Base: ${baseUrl.replace(/\/+$/, '')}`,
    '',
  ]
  for (const item of buildCronJobUrls(baseUrl, token)) {
    lines.push(`## ${item.label}`)
    lines.push(`# ${item.schedule}`)
    lines.push(item.url)
    lines.push('')
  }
  lines.push(`## 単体ソース例`)
  lines.push(`${baseUrl.replace(/\/+$/, '')}/api/cron/monitor?token=${encodeURIComponent(token)}&source=kokuchiz`)
  lines.push('')
  lines.push(`Playwright ソース: ${PLAYWRIGHT_SOCIAL_SOURCES.join(', ')}`)
  return lines.join('\n')
}
