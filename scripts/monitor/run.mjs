import {
  MICHINOEKI_PAGES,
  MIE_CITY_PAGES,
  MONITOR_KEYWORDS,
  PLAYWRIGHT_SOCIAL_SOURCES,
  SHOKOKAI_PAGES,
  SNS_KEYWORDS,
} from './config.mjs'
import {
  extractLinks,
  fetchText,
  getAdminSupabase,
  googleNewsRssUrl,
  hashId,
  kokuchizRssUrl,
  parseRssFeed,
  runFacebookSource,
  scrapeSearchPages,
  scrapeStaticPages,
  toMonitorItems,
  updateSourceRun,
  upsertHits,
} from './lib.mjs'
import { runAllPlaywrightSocialSources } from './playwright-social.mjs'

const REGULAR_JOBS = [
  ['kokuchiz', async () => {
    const all = []
    for (const keyword of MONITOR_KEYWORDS) {
      const items = await parseRssFeed(kokuchizRssUrl(keyword))
      all.push(...items)
    }
    return all
  }],
  ['google_news', async () => parseRssFeed(googleNewsRssUrl())],
  ['peatix', async () => {
    const all = []
    for (const keyword of MONITOR_KEYWORDS.slice(0, 3)) {
      try {
        const items = await parseRssFeed(
          `https://peatix.com/search/events.rss?q=${encodeURIComponent(keyword)}`,
        )
        all.push(...items)
      } catch {
        const items = await scrapeSearchPages(
          'peatix',
          'https://peatix.com/search?q={keyword}',
          [keyword],
        )
        all.push(...items)
      }
    }
    return all
  }],
  ['jmty', async () =>
    scrapeSearchPages('jmty', 'https://jmty.jp/articles?q={keyword}', MONITOR_KEYWORDS)],
  ['eventbank', async () =>
    scrapeSearchPages(
      'eventbank',
      'https://www.eventbank.jp/events?q={keyword}',
      MONITOR_KEYWORDS,
    )],
  ['mie_cities', async () => scrapeStaticPages('mie_cities', MIE_CITY_PAGES)],
  ['shokokai', async () => scrapeStaticPages('shokokai', SHOKOKAI_PAGES)],
  ['michinoeki', async () => scrapeStaticPages('michinoeki', MICHINOEKI_PAGES)],
  ['maipure_mie', async () => {
    const html = await fetchText('https://www.mie.maipure.com')
    return extractLinks(html, 'https://www.mie.maipure.com', 100).map((link) => ({
      externalId: hashId(link.url),
      title: link.title,
      url: link.url,
      snippet: link.snippet,
      publishedAt: null,
      raw: { source: 'maipure' },
    }))
  }],
  ['facebook', runFacebookSource],
]

async function runSource(sourceId, fn, keywordList = MONITOR_KEYWORDS) {
  const supabase = getAdminSupabase()
  try {
    const raw = await fn()
    if (raw?.skipped) {
      await updateSourceRun(supabase, sourceId, 'skipped', raw.reason)
      return { sourceId, hits: 0, skipped: true, reason: raw.reason }
    }
    const hits = toMonitorItems(sourceId, raw, keywordList)
    await upsertHits(supabase, hits)
    await updateSourceRun(supabase, sourceId, 'ok')
    return { sourceId, hits: hits.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await updateSourceRun(supabase, sourceId, 'error', msg)
    return { sourceId, hits: 0, error: msg }
  }
}

async function runPlaywrightSources(sourceIds, logger = console) {
  const results = []
  const batch = await runAllPlaywrightSocialSources(sourceIds)

  for (const sourceId of sourceIds) {
    logger.log?.(`▶ ${sourceId} (playwright)`)
    const entry = batch[sourceId]
    if (!entry) continue

    if (entry.skipped) {
      const result = await runSource(sourceId, async () => ({
        skipped: true,
        reason: entry.reason,
      }), SNS_KEYWORDS)
      results.push(result)
      logger.log?.(`  skip: ${entry.reason}`)
      continue
    }

    const result = await runSource(sourceId, async () => entry.items, SNS_KEYWORDS)
    results.push(result)
    if (result.error) {
      logger.error?.(`  ✗ ${result.error}`)
    } else {
      logger.log?.(`  ✓ ${result.hits} 件保存`)
    }
  }

  return results
}

/**
 * @param {{ sources?: string[] | null, logger?: Pick<Console, 'log' | 'error' | 'warn'> }} [options]
 */
export async function runMonitor(options = {}) {
  const { sources = null, logger = console } = options
  const runAll = !sources || sources.length === 0

  const regularPending = REGULAR_JOBS.filter(([id]) => runAll || sources.includes(id))
  const playwrightPending = PLAYWRIGHT_SOCIAL_SOURCES.filter(
    (id) => runAll || sources.includes(id),
  )

  logger.log?.(
    `monitor: ${regularPending.length} 通常ソース + ${playwrightPending.length} SNS(Playwright)`,
  )

  const regularResults = await Promise.all(
    regularPending.map(async ([id, fn]) => {
      logger.log?.(`▶ ${id}`)
      const result = await runSource(id, fn)
      if (result.skipped) {
        logger.log?.(`  skip: ${result.reason}`)
      } else if (result.error) {
        logger.error?.(`  ✗ ${result.error}`)
      } else {
        logger.log?.(`  ✓ ${result.hits} 件保存`)
      }
      return result
    }),
  )

  const playwrightResults =
    playwrightPending.length > 0
      ? await runPlaywrightSources(playwrightPending, logger)
      : []

  const results = [...regularResults, ...playwrightResults]
  const saved = results.reduce((n, r) => n + (r.hits ?? 0), 0)
  const errors = results.filter((r) => r.error)
  return { saved, results, errors, sourceCount: results.length }
}
