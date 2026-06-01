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

export function toMonitorItems(sourceId, rawItems, keywords = MONITOR_KEYWORDS) {
  const out = []
  for (const item of rawItems) {
    const blob = `${item.title}\n${item.snippet}`
    const matched =
      item.matchedKeywords?.length > 0
        ? item.matchedKeywords
        : matchKeywords(blob, keywords)
    if (matched.length === 0) continue
    out.push({
      source_id: sourceId,
      external_id: String(item.externalId).slice(0, 200),
      title: item.title.slice(0, 500),
      url: item.url,
      snippet: item.snippet.slice(0, 1000),
      matched_keywords: matched,
      published_at: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
      raw: item.raw ?? null,
    })
  }
  return out
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

export async function upsertHits(supabase, hits) {
  if (hits.length === 0) return { inserted: 0 }
  const { error } = await supabase.from('monitor_hits').upsert(hits, {
    onConflict: 'source_id,external_id',
    ignoreDuplicates: false,
  })
  if (error) throw error
  return { inserted: hits.length }
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
  const q = keywords.map((k) => `"${k}"`).join(' OR ')
  const params = new URLSearchParams({ q, hl: 'ja', gl: 'JP', ceid: 'JP:ja' })
  return `https://news.google.com/rss/search?${params.toString()}`
}

export function kokuchizRssUrl(keyword) {
  return `https://www.kokuchpro.com/s/q-${encodeURIComponent(keyword)}.rss`
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
          raw: { keyword, sourceUrl: url },
        })
      }
    } catch (err) {
      console.warn(`[${sourceId}] skip ${keyword}:`, err.message)
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
