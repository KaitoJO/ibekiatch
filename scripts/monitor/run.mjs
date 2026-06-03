import {
  AEON_MALL_PAGES,
  JA_MIE_PAGES,
  KITCHEN_CAR_PORTAL_PAGES,
  MICHINOEKI_PAGES,
  MIE_CITY_PAGES,
  MIE_TOURISM_PAGES,
  JMTY_KEYWORDS,
  MONITOR_KEYWORDS,
  OUTLET_MALL_PAGES,
  PLAYWRIGHT_SOCIAL_SOURCES,
  SHOKOKAI_PAGES,
  SNS_KEYWORDS,
} from './config.mjs'
import {
  getAdminSupabase,
  kokuchizRssUrl,
  parseRssFeed,
  purgeDisabledMonitorSources,
  purgeInvalidMonitorHits,
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
import { closeExpiredEvents, processMonitorHitsToEvents, recheckOpenEventsFromSources, purgeNonTokaiEvents } from './eventsPipeline.mjs'
import { ALL_CRON_SOURCE_IDS } from './cronBatches.mjs'
import { isExcludedNewsSource } from './excludedSources.mjs'

export { ALL_CRON_SOURCE_IDS, CRON_BATCHES, resolveCronRequest, formatCronJobUrlList } from './cronBatches.mjs'

const REGULAR_JOBS = [
  ['kokuchiz', async () => {
    const all = []
    for (const keyword of MONITOR_KEYWORDS) {
      const items = await parseRssFeed(kokuchizRssUrl(keyword))
      all.push(...items)
    }
    return all
  }],
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
  ['jmty', async () => scrapeJmty(JMTY_KEYWORDS), JMTY_KEYWORDS],
  ['eventbank', async () => {
    const fetchItems = await scrapeEventbank(MONITOR_KEYWORDS)
    if (fetchItems.length > 0) return fetchItems
    const { scrapeEventbankPlaywright } = await import('./playwright-social.mjs')
    return scrapeEventbankPlaywright(MONITOR_KEYWORDS)
  }],
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
      return {
        sourceId,
        hits: 0,
        skipped: true,
        reason: raw.reason,
        stats: { processed: 0, closedSkipped: 0, aiSkipped: 0 },
      }
    }
    const { hits, stats } = await toMonitorItems(sourceId, raw, keywordList)
    if (!dryRun) {
      const supabase = getAdminSupabase()
      await upsertHits(supabase, hits)
      await updateSourceRun(supabase, sourceId, 'ok')
    }
    return { sourceId, hits: hits.length, stats }
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
    return { sourceId, hits: 0, error: msg, stats: { processed: 0, closedSkipped: 0, aiSkipped: 0 } }
  }
}

function summarizeResults(results) {
  const saved = results.reduce((n, r) => n + (r.hits ?? 0), 0)
  const skippedSources = results.filter((r) => r.skipped).length
  const skippedHits = results.reduce(
    (n, r) => n + (r.stats?.closedSkipped ?? 0) + (r.stats?.aiSkipped ?? 0),
    0,
  )
  const processedCandidates = results.reduce((n, r) => n + (r.stats?.processed ?? 0), 0)
  return {
    processed: results.length,
    processedCandidates,
    saved,
    skipped: skippedSources + skippedHits,
    skippedSources,
    skippedHits,
  }
}

/** events パイプラインのみ（cron 最終ジョブ用） */
export async function runEventsPipeline(logger = console) {
  const supabase = getAdminSupabase()
  await closeExpiredEvents(supabase, logger)
  const purged = await purgeNonTokaiEvents(supabase, logger)
  const recheck = await recheckOpenEventsFromSources(supabase, { logger })
  const eventResult = await processMonitorHitsToEvents(supabase, { logger })
  const sk = eventResult.skipped ?? {}
  const eventSkipped =
    (sk.pastYear ?? 0) +
    (sk.pastDate ?? 0) +
    (sk.area ?? 0) +
    (sk.notRecruitment ?? 0) +
    (sk.lowScore ?? 0)

  logger.log?.(
    `monitor: events ${eventResult.published}/${eventResult.processed} 件保存 / skip ${eventSkipped} / 東海外 ${purged} / URL再チェック ${recheck.closed}`,
  )

  return {
    mode: 'pipeline',
    processed: eventResult.processed ?? 0,
    saved: eventResult.published ?? 0,
    skipped: eventSkipped,
    skippedSources: 0,
    skippedHits: 0,
    events: {
      processed: eventResult.processed ?? 0,
      published: eventResult.published ?? 0,
      retried: eventResult.retried ?? 0,
      skipped: sk,
    },
    purged,
    recheckClosed: recheck.closed ?? 0,
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
 * @param {{
 *   sources?: string[] | null,
 *   logger?: Pick<Console, 'log' | 'error' | 'warn'>,
 *   dryRun?: boolean,
 *   runPipeline?: boolean,
 *   runCleanup?: boolean,
 *   batch?: number | null,
 * }} [options]
 */
export async function runMonitor(options = {}) {
  const {
    sources = null,
    logger = console,
    dryRun = false,
    runPipeline = false,
    runCleanup = true,
    batch = null,
  } = options
  const runAll = !sources || sources.length === 0
  const shouldRunPipeline = runPipeline ?? runAll
  const shouldCleanup = runCleanup ?? (runAll || batch === 0)

  const regularPending = REGULAR_JOBS.filter(
    ([id]) => !isExcludedNewsSource(id) && (runAll || sources.includes(id)),
  )
  const playwrightPending = PLAYWRIGHT_SOCIAL_SOURCES.filter(
    (id) => runAll || sources.includes(id),
  )

  logger.log?.(
    `monitor: ${regularPending.length} 通常 + ${playwrightPending.length} SNS` +
      (batch != null ? ` (batch ${batch})` : runAll ? ' (all)' : ''),
  )

  if (dryRun) {
    logger.log?.('monitor: dry-run（Supabase への保存なし）')
  } else if (shouldCleanup) {
    try {
      const supabase = getAdminSupabase()
      const disabledRemoved = await purgeDisabledMonitorSources(supabase)
      const cleaned = await purgeInvalidMonitorHits(supabase)
      if (disabledRemoved > 0 || cleaned > 0) {
        logger.log?.(`monitor: クリーンアップ ${disabledRemoved + cleaned} 件削除`)
      }
    } catch (err) {
      logger.warn?.('monitor: クリーンアップ失敗:', err instanceof Error ? err.message : err)
    }
  }

  const regularResults = []
  for (const [id, fn, keywordList = MONITOR_KEYWORDS] of regularPending) {
    logger.log?.(`▶ ${id}`)
    const result = await runSource(id, fn, keywordList, dryRun)
    if (result.skipped) {
      logger.log?.(`  skip: ${result.reason}`)
    } else if (result.error) {
      const errMsg =
        typeof result.error === 'string'
          ? result.error
          : result.error?.message ?? JSON.stringify(result.error)
      logger.error?.(`  ✗ ${errMsg}`)
    } else {
      logger.log?.(`  ✓ ${result.hits} 件保存`)
    }
    regularResults.push(result)
  }

  const playwrightResults =
    playwrightPending.length > 0
      ? await runPlaywrightSources(playwrightPending, logger, dryRun)
      : []

  const results = [...regularResults, ...playwrightResults]
  const summary = summarizeResults(results)
  const errors = results.filter((r) => r.error)

  let events = null
  if (!dryRun && shouldRunPipeline) {
    try {
      const pipelineResult = await runEventsPipeline(logger)
      events = pipelineResult.events
      summary.pipeline = {
        processed: pipelineResult.processed,
        saved: pipelineResult.saved,
        skipped: pipelineResult.skipped,
      }
    } catch (err) {
      logger.warn?.('monitor: events pipeline failed:', err instanceof Error ? err.message : err)
    }
  }

  return {
    ...summary,
    results,
    errors,
    sourceCount: results.length,
    batch,
    events,
  }
}
