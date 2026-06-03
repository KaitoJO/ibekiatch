import * as cheerio from 'cheerio'
import { fetchText } from './lib.mjs'
import { isClosedRecruitmentText } from './recruitmentStatus.mjs'

const RECHECK_LIMIT = 15
const RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const PAGE_TEXT_MAX = 8000

function htmlToText(html) {
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, noscript').remove()
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, PAGE_TEXT_MAX)
}

async function fetchPageText(url) {
  try {
    const html = await fetchText(url)
    return htmlToText(html)
  } catch (err) {
    return null
  }
}

/**
 * 掲載中 events の source_url を再取得し、募集終了を検知したら closed に更新
 */
export async function recheckOpenEventsFromSources(supabase, { limit = RECHECK_LIMIT, logger = console } = {}) {
  const cutoff = new Date(Date.now() - RECHECK_INTERVAL_MS).toISOString()

  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, source_url, source_checked_at')
    .eq('status', 'open')
    .not('source_url', 'is', null)
    .or(`source_checked_at.is.null,source_checked_at.lt.${cutoff}`)
    .order('source_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) throw error
  if (!events?.length) return { checked: 0, closed: 0 }

  let closed = 0
  const now = new Date().toISOString()

  for (const event of events) {
    const url = event.source_url
    if (!url?.startsWith('http')) {
      await supabase.from('events').update({ source_checked_at: now }).eq('id', event.id)
      continue
    }

    const pageText = await fetchPageText(url)
    const checkedAt = { source_checked_at: now, updated_at: now }

    if (pageText && isClosedRecruitmentText(event.title, pageText)) {
      const { error: updErr } = await supabase
        .from('events')
        .update({ ...checkedAt, status: 'closed' })
        .eq('id', event.id)
      if (!updErr) {
        closed++
        logger.log?.(`[events] recheck closed: ${event.title.slice(0, 40)}`)
      }
    } else {
      await supabase.from('events').update(checkedAt).eq('id', event.id)
    }
  }

  logger.log?.(`[events] recheck ${events.length} URLs, closed ${closed}`)
  return { checked: events.length, closed }
}
