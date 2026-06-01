import {
  AEON_MALL_PAGES,
  JA_MIE_PAGES,
  KITCHEN_CAR_PORTAL_PAGES,
  MICHINOEKI_PAGES,
  MIE_CITY_PAGES,
  MIE_FM_PAGES,
  MIE_NEWS_PAGES,
  MIE_TOURISM_PAGES,
  MONITOR_KEYWORDS,
  OUTLET_MALL_PAGES,
  PLAYWRIGHT_SOCIAL_SOURCES,
  SHOKOKAI_PAGES,
  SNS_KEYWORDS,
} from './config.mjs'
import {
  getAdminSupabase,
  googleNewsRssUrl,
  kokuchizRssUrl,
  parseRssFeed,
  scrapeEventbank,
  scrapeJmty,
  scrapeMaipureMie,
  scrapeMichinoeki,
  scrapeMieCities,
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
  ['jmty', async () => scrapeJmty(MONITOR_KEYWORDS)],
  ['eventbank', async () => scrapeEventbank(MONITOR_KEYWORDS)],
  ['mie_cities', async () => scrapeMieCities(MIE_CITY_PAGES)],
  ['shokokai', async () => scrapeStaticPages('shokokai', SHOKOKAI_PAGES)],
  ['michinoeki', async () => scrapeMichinoeki(MICHINOEKI_PAGES)],
  ['maipure_mie', async () => scrapeMaipureMie(MONITOR_KEYWORDS)],
  ['mellow_shopstop', async () => scrapeStaticPages('mellow_shopstop', [KITCHEN_CAR_PORTAL_PAGES[0]])],
  ['mobimaru', async () => scrapeStaticPages('mobimaru', [KITCHEN_CAR_PORTAL_PAGES[1]])],
  ['kitchencar_madoguchi', async () => scrapeStaticPages('kitchencar_madoguchi', [KITCHEN_CAR_PORTAL_PAGES[2]])],
  ['aeon_mall', async () => scrapeStaticPages('aeon_mall', AEON_MALL_PAGES)],
  ['outlet_mall', async () => scrapeStaticPages('outlet_mall', OUTLET_MALL_PAGES)],
  ['mie_tourism', async () => scrapeStaticPages('mie_tourism', MIE_TOURISM_PAGES)],
  ['mie_news', async () => scrapeStaticPages('mie_news', MIE_NEWS_PAGES)],
  ['mie_fm', async () => scrapeStaticPages('mie_fm', MIE_FM_PAGES)],
  ['ja_mie', async () => scrapeStaticPages('ja_mie', JA_MIE_PAGES)],
]

async function runSource(sourceId, fn, keywordList = MONITOR_KEYWORDS, dryRun = false) {
  try {
    const raw = await fn()
    if (raw?.skipped) {
      if (!dryRun) {
        const supabase = getAdminSupabase()
        await updateSourceRun(supabase, sourceId, 'skipped', raw.reason)
      }
      return { sourceId, hits: 0, skipped: true, reason: raw.reason }
    }
    const hits = toMonitorItems(sourceId, raw, keywordList)
    if (!dryRun) {
      const supabase = getAdminSupabase()
      await upsertHits(supabase, hits)
      await updateSourceRun(supabase, sourceId, 'ok')
    }
    return { sourceId, hits: hits.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!dryRun) {
      try {
        const supabase = getAdminSupabase()
        await updateSourceRun(supabase, sourceId, 'error', msg)
      } catch {
        // ignore status update failure in dry-run fallback
      }
    }
    return { sourceId, hits: 0, error: msg }
  }
}

async function runPlaywrightSources(sourceIds, logger = console, dryRun = false) {
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
      }), SNS_KEYWORDS, dryRun)
      results.push(result)
      logger.log?.(`  skip: ${entry.reason}`)
      continue
    }

    const result = await runSource(sourceId, async () => entry.items, SNS_KEYWORDS, dryRun)
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
 * @param {{ sources?: string[] | null, logger?: Pick<Console, 'log' | 'error' | 'warn'>, dryRun?: boolean }} [options]
 */
export async function runMonitor(options = {}) {
  const { sources = null, logger = console, dryRun = false } = options
  const runAll = !sources || sources.length === 0

  const regularPending = REGULAR_JOBS.filter(([id]) => runAll || sources.includes(id))
  const playwrightPending = PLAYWRIGHT_SOCIAL_SOURCES.filter(
    (id) => runAll || sources.includes(id),
  )

  logger.log?.(
    `monitor: ${regularPending.length} 通常ソース + ${playwrightPending.length} SNS(Playwright)`,
  )

  if (dryRun) {
    logger.log?.('monitor: dry-run（Supabase への保存なし）')
  }

  const regularResults = await Promise.all(
    regularPending.map(async ([id, fn]) => {
      logger.log?.(`▶ ${id}`)
      const result = await runSource(id, fn, MONITOR_KEYWORDS, dryRun)
      if (result.skipped) {
        logger.log?.(`  skip: ${result.reason}`)
      } else if (result.error) {
        logger.error?.(`  ✗ ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}`)
      } else {
        logger.log?.(`  ✓ ${result.hits} 件保存`)
      }
      return result
    }),
  )

  const playwrightResults =
    playwrightPending.length > 0
      ? await runPlaywrightSources(playwrightPending, logger, dryRun)
      : []

  const results = [...regularResults, ...playwrightResults]
  const saved = results.reduce((n, r) => n + (r.hits ?? 0), 0)
  const errors = results.filter((r) => r.error)
  return { saved, results, errors, sourceCount: results.length }
}
