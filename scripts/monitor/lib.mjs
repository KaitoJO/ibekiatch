import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import Parser from 'rss-parser'
import {
  DEFAULT_UA,
  FETCH_TIMEOUT_MS,
  MONITOR_KEYWORDS,
} from './config.mjs'
import {
  filterRecruitmentPosts,
  isAcceptableMonitorTitle,
  isAcceptableMonitorUrl,
  normalizeExternalUrl,
  sanitizeMonitorItem,
} from './urlUtils.mjs'
import { isActiveMonitorHit, isClosedRecruitmentText } from './recruitmentStatus.mjs'
import { passesKeywordScore } from './keywordScoring.mjs'
import { shouldSkipBeforeAi } from './qualityScoring.mjs'
import { isExcludedNewsSource, EXCLUDED_NEWS_SOURCE_IDS } from './excludedSources.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

export function matchKeywords(text, keywords = MONITOR_KEYWORDS) {
  const hay = (text ?? '').toLowerCase()
  return keywords.filter((k) => hay.includes(k.toLowerCase()))
}

export function hashId(input) {
  return createHash('sha256').update(input).digest('hex').slice(0, 40)
}

export async function fetchText(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(options.headers ?? {}),
      },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

export function extractLinks(html, baseUrl, limit = 80) {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const items = []
  $('a[href]').each((_, el) => {
    const title = $(el).text().replace(/\s+/g, ' ').trim()
    const href = $(el).attr('href')
    if (!title || !href || title.length < 4) return
    let url
    try {
      url = new URL(href, base).toString()
    } catch {
      return
    }
    items.push({ title, url, snippet: title })
  })
  return items.slice(0, limit)
}

export async function parseRssFeed(url) {
  const parser = new Parser({ timeout: FETCH_TIMEOUT_MS, headers: { 'User-Agent': DEFAULT_UA } })
  const feed = await parser.parseURL(url)
  return (feed.items ?? []).map((item) => ({
    externalId: item.guid || item.link || item.title || hashId(JSON.stringify(item)),
    title: item.title?.trim() || '(無題)',
    url: item.link ?? null,
    snippet: (item.contentSnippet || item.content || item.summary || '').replace(/\s+/g, ' ').slice(0, 500),
    publishedAt: item.isoDate || item.pubDate || null,
    raw: { feedTitle: feed.title, item },
  }))
}

export async function toMonitorItems(sourceId, rawItems, keywords = MONITOR_KEYWORDS) {
  const candidates = []
  for (const item of rawItems) {
    const sanitized = sanitizeMonitorItem(item)
    if (!sanitized) continue

    const blob = `${sanitized.title}\n${sanitized.snippet}`
    const matched =
      item.matchedKeywords?.length > 0
        ? item.matchedKeywords
        : matchKeywords(blob, keywords)
    if (matched.length === 0) continue
    if (!passesKeywordScore(sanitized.title, sanitized.snippet)) continue
    if (shouldSkipBeforeAi(sanitized.title, sanitized.snippet)) continue
    if (isExcludedNewsSource(sourceId)) continue

    candidates.push({
      source_id: sourceId,
      external_id: String(sanitized.externalId ?? item.externalId).slice(0, 200),
      title: sanitized.title,
      url: sanitized.url,
      snippet: sanitized.snippet,
      matched_keywords: matched,
      published_at: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
      raw: item.raw ?? null,
    })
  }

  if (candidates.length === 0) {
    return { hits: [], stats: { processed: 0, closedSkipped: 0, aiSkipped: 0 } }
  }

  const openCandidates = candidates.filter(
    (c) => !isClosedRecruitmentText(c.title, c.snippet),
  )
  const closedSkipped = candidates.length - openCandidates.length
  if (closedSkipped > 0) {
    console.log(`[${sourceId}] 募集終了除外: ${closedSkipped} 件`)
  }
  if (openCandidates.length === 0) {
    return {
      hits: [],
      stats: { processed: candidates.length, closedSkipped, aiSkipped: 0 },
    }
  }

  const before = openCandidates.length
  const filtered = await filterRecruitmentPosts(openCandidates, sourceId)
  const aiSkipped = before - filtered.length
  if (aiSkipped > 0) {
    console.log(`[${sourceId}] AI判定: ${filtered.length}/${before} 件を募集として採用`)
  }
  return {
    hits: filtered,
    stats: { processed: candidates.length, closedSkipped, aiSkipped },
  }
}

export function getAdminSupabase() {
  const fileEnv = parseEnvFile(resolve(root, '.env'))
  const url = (fileEnv.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const key = (fileEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY と VITE_SUPABASE_URL が必要です（.env に設定）',
    )
  }
  return createClient(url.replace(/\/rest\/v1\/?$/i, ''), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function sanitizeJsonValue(value) {
  if (value == null) return null
  if (typeof value === 'string') {
    return value.replace(/[\uD800-\uDFFF]/g, '')
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeJsonValue)
  }
  if (typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value)) {
      out[key] = sanitizeJsonValue(val)
    }
    return out
  }
  return value
}

export async function upsertHits(supabase, hits) {
  if (hits.length === 0) return { inserted: 0 }
  const deduped = new Map()
  for (const hit of hits) {
    const key = `${hit.source_id}:${hit.external_id}`
    deduped.set(key, hit)
  }
  const rows = [...deduped.values()].map((hit) => ({
    ...hit,
    title: (hit.title ?? '').replace(/[\uD800-\uDFFF]/g, ''),
    snippet: (hit.snippet ?? '').replace(/[\uD800-\uDFFF]/g, ''),
    raw: sanitizeJsonValue(hit.raw),
  }))
  const { error } = await supabase.from('monitor_hits').upsert(rows, {
    onConflict: 'source_id,external_id',
    ignoreDuplicates: false,
  })
  if (error) throw error
  return { inserted: rows.length }
}

export async function purgeMonitorSource(supabase, sourceId) {
  const { error, count } = await supabase
    .from('monitor_hits')
    .delete({ count: 'exact' })
    .eq('source_id', sourceId)
  if (error) throw error
  return count ?? 0
}

export async function purgeDisabledMonitorSources(supabase) {
  let total = 0
  for (const sourceId of ['threads', 'facebook', ...EXCLUDED_NEWS_SOURCE_IDS]) {
    total += await purgeMonitorSource(supabase, sourceId)
  }
  return total
}

export async function purgeInvalidMonitorHits(supabase) {
  let totalRemoved = 0
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('monitor_hits')
      .select('id, source_id, title, url, snippet')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break

    const toDelete = data.filter((row) => {
      if (row.source_id === 'threads' || row.source_id === 'facebook') return true
      if (isExcludedNewsSource(row.source_id)) return true
      if (!sanitizeMonitorItem(row)) return true
      return !isActiveMonitorHit(row)
    })

    if (toDelete.length > 0) {
      const ids = toDelete.map((r) => r.id)
      const { error: delErr } = await supabase.from('monitor_hits').delete().in('id', ids)
      if (delErr) throw delErr
      totalRemoved += ids.length
    }

    if (data.length < pageSize) break
    from += pageSize
  }

  return totalRemoved
}

export async function updateSourceRun(supabase, sourceId, status, errorMessage = null) {
  await supabase
    .from('monitor_sources')
    .update({
      last_run_at: new Date().toISOString(),
      last_status: status,
      last_error: errorMessage,
    })
    .eq('id', sourceId)
}

export function googleNewsRssUrl(keywords = MONITOR_KEYWORDS) {
  const kw = keywords.map((k) => `"${k}"`).join(' OR ')
  const region = '(三重 OR 静岡 OR 愛知 OR 岐阜 OR 東海 OR 名古屋 OR 浜松 OR 四日市 OR 伊勢)'
  const params = new URLSearchParams({ q: `(${kw}) ${region}`, hl: 'ja', gl: 'JP', ceid: 'JP:ja' })
  return `https://news.google.com/rss/search?${params.toString()}`
}

export function kokuchizRssUrl(keyword) {
  return `https://www.kokuchpro.com/s/q-${encodeURIComponent(keyword)}.rss`
}

function keywordsForSearch(title, keyword, keywords = MONITOR_KEYWORDS) {
  const fromText = matchKeywords(`${title}\n${keyword}`, keywords)
  if (fromText.length > 0) return fromText
  if (keywords.includes(keyword)) return [keyword]
  return []
}

export async function scrapeSearchPages(sourceId, searchUrlPattern, keywords) {
  const seen = new Set()
  const raw = []
  for (const keyword of keywords) {
    const url = searchUrlPattern.replace('{keyword}', encodeURIComponent(keyword))
    try {
      const html = await fetchText(url)
      for (const link of extractLinks(html, url)) {
        const key = link.url
        if (seen.has(key)) continue
        seen.add(key)
        raw.push({
          externalId: hashId(key),
          title: link.title,
          url: link.url,
          snippet: link.snippet,
          publishedAt: null,
          matchedKeywords: keywordsForSearch(link.title, keyword),
          raw: { keyword, sourceUrl: url },
        })
      }
    } catch (err) {
      console.warn(`[${sourceId}] skip ${keyword}:`, err.message)
    }
  }
  return raw
}

function jmtyItemText($item) {
  const title = $item.find('.p-item-title').first().text().replace(/\s+/g, ' ').trim()
  const body = $item.find('.p-item-detail').first().text().replace(/\s+/g, ' ').trim()
  return { title, body }
}

export async function scrapeJmty(keywords) {
  const { JMTY_KEYWORDS, JMTY_TOKAI_PREFECTURES, JMty_CATEGORIES, jmtySearchUrl } =
    await import('./config.mjs')
  const { isTokaiRegionText } = await import('./tokaiRegion.mjs')
  const filterKeywords = keywords ?? JMTY_KEYWORDS
  const seen = new Set()
  const raw = []
  for (const pref of JMTY_TOKAI_PREFECTURES) {
    for (const keyword of filterKeywords) {
      for (const category of JMty_CATEGORIES) {
        const url = jmtySearchUrl(keyword, category, pref.slug)
        try {
          const html = await fetchText(url)
          const $ = cheerio.load(html)
          const items = $('.p-articles-list-item')
          if (items.length > 0) {
            items.each((_, el) => {
              const $item = $(el)
              const href = $item.find('a[href*="/article-"]').first().attr('href')
              if (!href) return
              const { title, body } = jmtyItemText($item)
              if (!title) return
              const blob = `${title}\n${body}`
              if (!isTokaiRegionText(blob)) return
              const matched = matchKeywords(blob, filterKeywords)
              if (matched.length === 0) return
              const linkUrl = new URL(href, 'https://jmty.jp').toString()
              if (seen.has(linkUrl)) return
              seen.add(linkUrl)
              raw.push({
                externalId: hashId(linkUrl),
                title,
                url: linkUrl,
                snippet: body || title,
                publishedAt: null,
                matchedKeywords: matched,
                raw: { keyword, category, sourceUrl: url, prefecture: pref.slug },
              })
            })
          } else {
            for (const link of extractLinks(html, url, 60)) {
              const blob = `${link.title}\n${link.snippet ?? ''}`
              if (!isTokaiRegionText(blob)) continue
              const matched = matchKeywords(blob, filterKeywords)
              if (matched.length === 0) continue
              if (seen.has(link.url)) continue
              seen.add(link.url)
              raw.push({
                externalId: hashId(link.url),
                title: link.title,
                url: link.url,
                snippet: link.snippet,
                publishedAt: null,
                matchedKeywords: matched,
                raw: { keyword, category, sourceUrl: url, prefecture: pref.slug },
              })
            }
          }
        } catch (err) {
          console.warn(`[jmty] skip ${pref.slug}/${keyword}/${category}:`, err.message)
        }
      }
    }
  }
  return raw
}

export async function scrapeMaipureMie(keywords = MONITOR_KEYWORDS) {
  const { MAIPURE_MIE_BASE } = await import('./config.mjs')
  const seen = new Set()
  const raw = []
  for (const keyword of keywords) {
    const url = `${MAIPURE_MIE_BASE}/search?keyword=${encodeURIComponent(keyword)}`
    try {
      const html = await fetchText(url)
      const $ = cheerio.load(html)
      $('a[href]').each((_, el) => {
        const title = $(el).text().replace(/\s+/g, ' ').trim()
        const href = $(el).attr('href')
        if (!title || !href || title.length < 6) return
        if (!href.startsWith('/') && !href.includes('mypl.net')) return
        const linkUrl = new URL(href, MAIPURE_MIE_BASE).toString()
        if (!linkUrl.includes('mypl.net')) return
        if (seen.has(linkUrl)) return
        seen.add(linkUrl)
        raw.push({
          externalId: hashId(linkUrl),
          title,
          url: linkUrl,
          snippet: title,
          publishedAt: null,
          matchedKeywords: keywordsForSearch(title, keyword),
          raw: { keyword, sourceUrl: url },
        })
      })
    } catch (err) {
      console.warn(`[maipure_mie] skip ${keyword}:`, err.message)
    }
  }
  if (raw.length === 0) {
    try {
      const html = await fetchText(MAIPURE_MIE_BASE)
      for (const link of extractLinks(html, MAIPURE_MIE_BASE, 80)) {
        if (seen.has(link.url)) continue
        seen.add(link.url)
        raw.push({
          externalId: hashId(link.url),
          title: link.title,
          url: link.url,
          snippet: link.snippet,
          publishedAt: null,
          raw: { sourceUrl: MAIPURE_MIE_BASE },
        })
      }
    } catch (err) {
      console.warn('[maipure_mie] skip top page:', err.message)
    }
  }
  return raw
}

export async function scrapeEventbank(keywords = MONITOR_KEYWORDS) {
  const seen = new Set()
  const raw = []
  const searchOpts = {
    buildQuery: (k) => `site:eventbank.jp OR site:press.eventbank.jp ${k}`,
    linkIncludes: ['eventbank.jp'],
    urlPattern: /eventbank\.jp\//i,
  }

  for (const keyword of keywords) {
    let items = []
    try {
      items = await scrapeGoogleSiteFetch(keyword, searchOpts)
    } catch (err) {
      console.warn(`[eventbank] google skip ${keyword}:`, err.message)
    }

    if (items.length === 0) {
      try {
        items = await scrapeDdgSiteFetch(keyword, searchOpts)
      } catch (err) {
        console.warn(`[eventbank] ddg skip ${keyword}:`, err.message)
      }
    }

    for (const item of items) {
      const sanitized = sanitizeMonitorItem(item)
      if (!sanitized) continue
      if (seen.has(sanitized.url)) continue
      seen.add(sanitized.url)
      raw.push({
        ...sanitized,
        externalId: hashId(sanitized.url),
        publishedAt: null,
        matchedKeywords: keywordsForSearch(`${sanitized.title}\n${sanitized.snippet}`, keyword),
        raw: { ...(item.raw ?? {}), keyword, via: item.raw?.via ?? 'search' },
      })
    }
  }
  return raw
}

/** Google 検索（fetch + cheerio）— SNS フォールバック用 */
export async function scrapeGoogleSiteFetch(keyword, { buildQuery, linkIncludes = [], urlPattern = null }) {
  const query = buildQuery(keyword)
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ja&num=20`
  const html = await fetchText(url)
  const $ = cheerio.load(html)
  const items = []
  const seen = new Set()

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    const linkUrl = normalizeExternalUrl(href, 'https://www.google.com')
    if (!linkUrl || !isAcceptableMonitorUrl(linkUrl)) return
    if (linkIncludes.length > 0 && !linkIncludes.some((s) => linkUrl.includes(s))) return
    if (urlPattern && !urlPattern.test(linkUrl)) return
    const block = $(el).closest('div').parent()
    const title =
      block.find('h3').first().text().trim() ||
      $(el).text().replace(/\s+/g, ' ').trim()
    if (!isAcceptableMonitorTitle(title)) return
    if (seen.has(linkUrl)) return
    seen.add(linkUrl)
    items.push({
      externalId: hashId(linkUrl),
      title,
      url: linkUrl,
      snippet: title,
      publishedAt: null,
      raw: { keyword, via: 'google-fetch' },
    })
  })
  return items
}

/** Google News RSS — SNS サイト内検索（fetch ベースで安定） */
export async function scrapeGoogleNewsSite(keyword, { siteDomain, limit = 25 }) {
  const query = `site:${siteDomain} ${keyword}`
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`
  const feedItems = await parseRssFeed(url)
  const items = []
  const seen = new Set()
  const domainHint = siteDomain.replace(/^www\./, '').toLowerCase()
  for (const item of feedItems) {
    if (items.length >= limit) break
    const linkUrl = item.url ?? ''
    if (!linkUrl.startsWith('http')) continue
    const blob = `${item.title} ${item.snippet}`.toLowerCase()
    if (!blob.includes(domainHint) && !linkUrl.includes(domainHint)) continue
    if (seen.has(linkUrl)) continue
    seen.add(linkUrl)
    items.push({
      externalId: hashId(linkUrl),
      title: item.title,
      url: linkUrl,
      snippet: item.snippet || item.title,
      publishedAt: item.publishedAt,
      raw: { keyword, siteDomain, via: 'google-news-rss' },
    })
  }
  return items
}

/** DuckDuckGo HTML 検索 — Google ブロック時の SNS フォールバック */
export async function scrapeDdgSiteFetch(keyword, { buildQuery, linkIncludes = [], urlPattern = null }) {
  const query = buildQuery(keyword)
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const html = await fetchText(url)
  const $ = cheerio.load(html)
  const items = []
  const seen = new Set()

  $('a.result__a, a.result__url').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    let linkUrl = href
    if (href.includes('uddg=')) {
      try {
        linkUrl = decodeURIComponent(
          new URL(href, 'https://duckduckgo.com').searchParams.get('uddg') ?? href,
        )
      } catch {
        return
      }
    }
    if (!linkUrl.startsWith('http')) return
    if (/duckduckgo\.com\/y\.js|ad_domain=/i.test(linkUrl)) return
    linkUrl = normalizeExternalUrl(linkUrl) ?? linkUrl
    if (!linkUrl.startsWith('http') || !isAcceptableMonitorUrl(linkUrl)) return
    if (linkIncludes.length > 0 && !linkIncludes.some((s) => linkUrl.includes(s))) return
    if (urlPattern && !urlPattern.test(linkUrl)) return
    const title = $(el).text().replace(/\s+/g, ' ').trim()
    if (!isAcceptableMonitorTitle(title)) return
    if (seen.has(linkUrl)) return
    seen.add(linkUrl)
    items.push({
      externalId: hashId(linkUrl),
      title,
      url: linkUrl,
      snippet: title,
      publishedAt: null,
      raw: { keyword, via: 'ddg-fetch' },
    })
  })
  return items
}

export async function scrapeMichinoeki(pages) {
  const { MICHINOEKI_PAGES } = await import('./config.mjs')
  const targetPages = pages ?? MICHINOEKI_PAGES
  const seen = new Set()
  const raw = []
  for (const page of targetPages) {
    for (const url of page.urls ?? [page.url]) {
      if (!url) continue
      try {
        const html = await fetchText(url)
        const $ = cheerio.load(html)
        $('a[href]').each((_, el) => {
          const title = $(el).text().replace(/\s+/g, ' ').trim()
          const href = $(el).attr('href')
          if (!title || !href || title.length < 4) return
          let linkUrl
          try {
            linkUrl = new URL(href, url).toString()
          } catch {
            return
          }
          if (seen.has(linkUrl)) return
          seen.add(linkUrl)
          raw.push({
            externalId: hashId(linkUrl),
            title: `[${page.name}] ${title}`,
            url: linkUrl,
            snippet: title,
            publishedAt: null,
            matchedKeywords: matchKeywords(title),
            raw: { page: page.name, sourceUrl: url },
          })
        })
      } catch (err) {
        console.warn(`[michinoeki] skip ${page.name}:`, err.message)
      }
    }
  }
  return raw
}

/** 三重県市町村のイベント・お知らせページを直接スクレイプ */
export async function scrapeMieCities(pages) {
  const { MIE_CITY_PAGES } = await import('./config.mjs')
  const targetPages = pages ?? MIE_CITY_PAGES
  const seen = new Set()
  const raw = []

  function pushEntry({ cityName, title, url, snippet, sourceUrl }) {
    const cleanTitle = (title ?? '').replace(/\s+/g, ' ').trim()
    if (!cleanTitle || cleanTitle.length < 4) return
    const cleanSnippet = (snippet ?? cleanTitle).replace(/\s+/g, ' ').trim().slice(0, 500)
    const key = url || `${cityName}:${cleanTitle}`
    if (seen.has(key)) return
    seen.add(key)
    raw.push({
      externalId: hashId(key),
      title: `[${cityName}] ${cleanTitle}`,
      url,
      snippet: cleanSnippet,
      publishedAt: null,
      raw: { page: cityName, sourceUrl },
    })
  }

  for (const page of targetPages) {
    for (const url of page.urls ?? [page.url]) {
      if (!url) continue
      try {
        const html = await fetchText(url)
        const $ = cheerio.load(html)

        $('a[href]').each((_, el) => {
          const title = $(el).text().replace(/\s+/g, ' ').trim()
          const href = $(el).attr('href')
          if (!title || !href || title.length < 4) return
          let linkUrl
          try {
            linkUrl = new URL(href, url).toString()
          } catch {
            return
          }
          const parent = $(el).closest('li, tr, article, dd, .news, .list, .item')
          const snippet =
            parent.length > 0
              ? parent.text().replace(/\s+/g, ' ').trim().slice(0, 500)
              : title
          pushEntry({
            cityName: page.name,
            title,
            url: linkUrl,
            snippet,
            sourceUrl: url,
          })
        })

        $('table tr, ul.news li, ul li, dl dt, .event-item, .calendar-item').each((_, el) => {
          const text = $(el).text().replace(/\s+/g, ' ').trim()
          if (text.length < 8 || text.length > 400) return
          const link = $(el).find('a[href]').first()
          const title = link.length ? link.text().replace(/\s+/g, ' ').trim() : text.slice(0, 120)
          let linkUrl = url
          if (link.length) {
            try {
              linkUrl = new URL(link.attr('href'), url).toString()
            } catch {
              linkUrl = url
            }
          }
          pushEntry({
            cityName: page.name,
            title,
            url: linkUrl,
            snippet: text,
            sourceUrl: url,
          })
        })
      } catch (err) {
        console.warn(`[mie_cities] skip ${page.name} ${url}:`, err.message)
      }
    }
  }
  return raw
}

export async function scrapeStaticPages(sourceId, pages) {
  const seen = new Set()
  const raw = []
  for (const page of pages) {
    for (const url of page.urls ?? [page.url]) {
      if (!url) continue
      try {
        const html = await fetchText(url)
        for (const link of extractLinks(html, url, 120)) {
          const key = link.url
          if (seen.has(key)) continue
          seen.add(key)
          raw.push({
            externalId: hashId(key),
            title: `[${page.name}] ${link.title}`,
            url: link.url,
            snippet: link.snippet,
            publishedAt: null,
            raw: { page: page.name, sourceUrl: url },
          })
        }
      } catch (err) {
        console.warn(`[${sourceId}] skip ${page.name}:`, err.message)
      }
    }
  }
  return raw
}

export async function runTwitterSource() {
  const token = process.env.TWITTER_BEARER_TOKEN?.trim()
  if (!token) {
    return { skipped: true, reason: 'TWITTER_BEARER_TOKEN 未設定' }
  }
  const query = MONITOR_KEYWORDS.map((k) => `"${k}"`).join(' OR ')
  const params = new URLSearchParams({
    query: `${query} -is:retweet lang:ja`,
    max_results: '20',
    'tweet.fields': 'created_at,entities',
  })
  const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Twitter API ${res.status}`)
  const json = await res.json()
  return (json.data ?? []).map((tweet) => ({
    externalId: tweet.id,
    title: tweet.text.slice(0, 200),
    url: `https://x.com/i/web/status/${tweet.id}`,
    snippet: tweet.text,
    publishedAt: tweet.created_at,
    raw: tweet,
  }))
}

export async function runInstagramSource() {
  const token = process.env.META_ACCESS_TOKEN?.trim()
  if (!token) return { skipped: true, reason: 'META_ACCESS_TOKEN 未設定' }
  const tags = ['キッチンカー', 'フードトラック', '出店募集']
  const raw = []
  for (const tag of tags) {
    const url = `https://graph.facebook.com/v19.0/ig_hashtag_search?q=${encodeURIComponent(tag)}&access_token=${token}`
    const res = await fetch(url)
    if (!res.ok) continue
    const json = await res.json()
    for (const item of json.data ?? []) {
      raw.push({
        externalId: item.id,
        title: `#${tag} (Instagram)`,
        url: `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`,
        snippet: `ハッシュタグ #${tag} の投稿`,
        publishedAt: null,
        raw: item,
      })
    }
  }
  return raw
}

export async function runFacebookSource() {
  const token = process.env.META_ACCESS_TOKEN?.trim()
  const pages = (process.env.FACEBOOK_PAGE_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!token) return { skipped: true, reason: 'META_ACCESS_TOKEN 未設定' }
  if (pages.length === 0) return { skipped: true, reason: 'FACEBOOK_PAGE_IDS 未設定' }
  const raw = []
  for (const pageId of pages) {
    const url = `https://graph.facebook.com/v19.0/${pageId}/feed?fields=message,created_time,permalink_url&limit=20&access_token=${token}`
    const res = await fetch(url)
    if (!res.ok) continue
    const json = await res.json()
    for (const post of json.data ?? []) {
      if (!post.message) continue
      raw.push({
        externalId: post.id,
        title: post.message.slice(0, 120),
        url: post.permalink_url,
        snippet: post.message,
        publishedAt: post.created_time,
        raw: post,
      })
    }
  }
  return raw
}
