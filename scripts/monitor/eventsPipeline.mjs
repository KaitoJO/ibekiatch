import {
  structureEventWithTieredAi,
  shouldPublishEvent,
} from './eventStructuring.mjs'
import { scoreRecruitmentText } from './keywordScoring.mjs'
import { isClosedRecruitmentText, todayInJstDateKey } from './recruitmentStatus.mjs'
import { shouldSkipBeforeAi } from './qualityScoring.mjs'
import { normalizeOrganizerKey, pickOrganizerLabel } from './organizerEntity.mjs'
import { recheckOpenEventsFromSources } from './eventRecheck.mjs'
import { isRecruitmentPost } from './urlUtils.mjs'
import { resolveVenueAndPrefecture } from './prefectureMap.mjs'
import {
  resolveTokaiArea,
  isTokaiRegionText,
  MIE_LOCAL_SOURCE_IDS,
  hitProcessingPriority,
  getPublishConfidenceMin,
} from './tokaiRegion.mjs'
import { notifyNewEventPush } from '../../api/lib/webPushShared.mjs'
import { isExcludedNewsSource } from './excludedSources.mjs'

const BATCH_LIMIT = 80
const CANDIDATE_POOL = 400
const MIE_CANDIDATE_POOL = 200

const HIT_SELECT =
  'id, source_id, title, url, snippet, matched_keywords, created_at'

const PAST_YEAR_RE = /(19\d{2}|20\d{2})/g

function currentYearJst() {
  return parseInt(todayInJstDateKey().slice(0, 4), 10)
}

/** タイトル・本文に現在年より前の西暦が含まれる */
export function hasPastYearInText(...parts) {
  const currentYear = currentYearJst()
  const blob = parts.filter(Boolean).join('\n')
  if (!blob.trim()) return false
  for (const match of blob.matchAll(PAST_YEAR_RE)) {
    const year = parseInt(match[1], 10)
    if (year < currentYear) return true
  }
  return false
}

/** event_date が今日より過去なら true（null は false = 保存可） */
export function isPastEventDate(eventDate) {
  if (!eventDate) return false
  return eventDate < todayInJstDateKey()
}

function passesAreaCheck(hit, structured) {
  if (MIE_LOCAL_SOURCE_IDS.has(hit.source_id)) return true
  const tokai = resolveTokaiArea(
    structured.title,
    structured.location,
    hit.snippet,
    hit.source_id,
  )
  if (tokai) return true
  return isTokaiRegionText(structured.title, structured.location, hit.snippet)
}

function applyTokaiArea(structured, hit) {
  const resolved = resolveVenueAndPrefecture({
    title: structured.title,
    location: structured.location,
    snippet: hit.snippet,
    sourceId: hit.source_id,
  })

  structured.location = resolved.venue || structured.location
  structured.prefecture = resolved.prefecture || structured.prefecture || ''
  structured.area = structured.prefecture

  const tokai = resolveTokaiArea(
    structured.title,
    structured.location,
    hit.snippet,
    hit.source_id,
  )
  if (tokai) {
    structured.prefecture = tokai.prefecture
    structured.area = tokai.prefecture
    if (!structured.location && tokai.area !== tokai.prefecture) {
      structured.location = tokai.area
    }
    structured.in_tokai = true
  } else if (MIE_LOCAL_SOURCE_IDS.has(hit.source_id)) {
    structured.in_tokai = true
    if (!structured.prefecture) {
      structured.prefecture = '三重県'
      structured.area = '三重県'
    }
  }
}

function eventRowFromHit(hit, structured, keywordScore) {
  const organizer = pickOrganizerLabel(structured.organizer, structured.title)
  return {
    monitor_hit_id: hit.id,
    source_id: hit.source_id,
    origin: 'collected',
    title: structured.title,
    organizer,
    organizer_key: normalizeOrganizerKey(organizer, structured.title),
    location: structured.location,
    area: structured.area,
    prefecture: structured.prefecture ?? structured.area ?? '',
    event_date: structured.event_date,
    recruit_start: structured.recruit_start,
    recruit_end: structured.recruit_end,
    fee: structured.fee,
    category: structured.category,
    application_url: structured.application_url,
    source_url: structured.source_url || hit.url,
    description: hit.snippet?.slice(0, 1000) ?? '',
    status: 'open',
    confidence: structured.confidence,
    keyword_score: keywordScore,
    updated_at: new Date().toISOString(),
  }
}

async function fetchPrioritizedPendingHits(supabase, limit) {
  const { data: existing } = await supabase
    .from('events')
    .select('monitor_hit_id, status')
    .not('monitor_hit_id', 'is', null)

  // open に紐づく hit のみスキップ（closed イベントは再処理可）
  const done = new Set(
    (existing ?? [])
      .filter((e) => e.status === 'open')
      .map((e) => e.monitor_hit_id),
  )

  const [recentRes, mieRes] = await Promise.all([
    supabase
      .from('monitor_hits')
      .select(HIT_SELECT)
      .order('created_at', { ascending: false })
      .limit(CANDIDATE_POOL),
    supabase
      .from('monitor_hits')
      .select(HIT_SELECT)
      .in('source_id', [...MIE_LOCAL_SOURCE_IDS])
      .order('created_at', { ascending: false })
      .limit(MIE_CANDIDATE_POOL),
  ])

  if (recentRes.error) throw recentRes.error
  if (mieRes.error) throw mieRes.error

  const byId = new Map()
  for (const h of [...(recentRes.data ?? []), ...(mieRes.data ?? [])]) {
    byId.set(h.id, h)
  }
  const hits = [...byId.values()]
  if (!hits.length) return []

  return hits
    .filter((h) => !done.has(h.id))
    .sort((a, b) => {
      const kwa = scoreRecruitmentText(a.title, a.snippet)
      const kwb = scoreRecruitmentText(b.title, b.snippet)
      const pa = hitProcessingPriority(a, kwa)
      const pb = hitProcessingPriority(b, kwb)
      if (pb !== pa) return pb - pa
      if (kwb !== kwa) return kwb - kwa
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, limit)
}

/** 未処理の monitor_hits を events に変換（東海ソース優先） */
export async function processMonitorHitsToEvents(supabase, { limit = BATCH_LIMIT, logger = console } = {}) {
  const pending = await fetchPrioritizedPendingHits(supabase, limit)
  if (pending.length === 0) {
    return {
      processed: 0,
      published: 0,
      retried: 0,
      skipped: { pastYear: 0, pastDate: 0, area: 0, notRecruitment: 0 },
    }
  }

  let processed = 0
  let published = 0
  let retried = 0
  const skipped = { pastYear: 0, pastDate: 0, area: 0, notRecruitment: 0 }

  for (const hit of pending) {
    processed++
    if (isExcludedNewsSource(hit.source_id)) {
      skipped.notRecruitment++
      continue
    }
    let keywordScore = scoreRecruitmentText(hit.title, hit.snippet)
    const recruitHint = /募集|移動販売|出店者|応募|マルシェ出店/.test(
      `${hit.title ?? ''}\n${hit.snippet ?? ''}`,
    )
    if (
      keywordScore < 25 &&
      recruitHint &&
      (MIE_LOCAL_SOURCE_IDS.has(hit.source_id) || isTokaiRegionText(hit.title, hit.snippet))
    ) {
      keywordScore = 25
    }
    if (keywordScore < 25) continue
    if (isClosedRecruitmentText(hit.title, hit.snippet)) continue
    if (shouldSkipBeforeAi(hit.title, hit.snippet)) continue

    if (hasPastYearInText(hit.title, hit.snippet)) {
      skipped.pastYear++
      continue
    }

    const preTokai =
      MIE_LOCAL_SOURCE_IDS.has(hit.source_id) ||
      resolveTokaiArea(hit.title, '', hit.snippet, hit.source_id) ||
      isTokaiRegionText(hit.title, hit.snippet)
    if (!preTokai) {
      skipped.area++
      continue
    }

    try {
      const recruitmentOk = await isRecruitmentPost(hit.title, hit.snippet, hit.source_id)
      if (!recruitmentOk) {
        skipped.notRecruitment++
        continue
      }

      const structured = await structureEventWithTieredAi(
        hit.title,
        hit.snippet,
        hit.source_id,
        hit.url,
      )

      applyTokaiArea(structured, hit)

      if (!passesAreaCheck(hit, structured)) {
        skipped.area++
        continue
      }

      if (isPastEventDate(structured.event_date)) {
        skipped.pastDate++
        continue
      }

      const minConf = getPublishConfidenceMin(hit.source_id, {
        hitTitle: hit.title,
        hitSnippet: hit.snippet,
      })
      if (structured.confidence >= minConf - 15 && structured.confidence < minConf) retried++

      if (
        !shouldPublishEvent(structured, hit.source_id, {
          title: hit.title,
          snippet: hit.snippet,
        })
      ) {
        continue
      }

      const row = eventRowFromHit(hit, structured, keywordScore)

      const { data: prior } = await supabase
        .from('events')
        .select('id')
        .eq('monitor_hit_id', hit.id)
        .maybeSingle()

      const { data: saved, error: insertErr } = await supabase
        .from('events')
        .upsert(row, { onConflict: 'monitor_hit_id' })
        .select('id, title, location, area, recruit_end')
        .single()

      if (insertErr) {
        logger.warn?.('[events] insert error:', insertErr.message)
        continue
      }
      published++
      logger.log?.(`[events] ✓ ${structured.title.slice(0, 50)}`)

      if (saved && !prior) {
        await notifyNewEventPush(supabase, saved, logger)
      }
    } catch (err) {
      logger.warn?.('[events] process error:', err instanceof Error ? err.message : err)
    }
  }

  const skipTotal = skipped.pastYear + skipped.pastDate + skipped.area + skipped.notRecruitment
  if (skipTotal > 0) {
    logger.log?.(
      `[events] skipped ${skipTotal} (year=${skipped.pastYear} date=${skipped.pastDate} area=${skipped.area} ai=${skipped.notRecruitment})`,
    )
  }

  return { processed, published, retried, skipped }
}

export async function closeExpiredEvents(supabase, logger = console) {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('events')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('status', 'open')
    .lt('recruit_end', today)
    .select('id')

  if (error) throw error
  const count = data?.length ?? 0
  if (count > 0) logger.log?.(`[events] closed ${count} expired`)
  return count
}

/** 東海以外の events を closed に */
export async function purgeNonTokaiEvents(supabase, logger = console) {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, location, area, description, source_id, status')
    .eq('status', 'open')

  if (error) throw error
  if (!events?.length) return 0

  const toClose = events.filter((e) => {
    if (MIE_LOCAL_SOURCE_IDS.has(e.source_id)) return false
    return !isTokaiRegionText(e.title, e.location, e.description ?? '')
  })
  if (toClose.length === 0) return 0

  const ids = toClose.map((e) => e.id)
  const { error: updErr } = await supabase
    .from('events')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .in('id', ids)

  if (updErr) throw updErr
  logger.log?.(`[events] 東海以外 ${toClose.length} 件を非表示`)
  return toClose.length
}

export { recheckOpenEventsFromSources }
