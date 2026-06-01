import { DEFAULT_UA, SNS_KEYWORDS } from './config.mjs'
import { hashId, matchKeywords, scrapeDdgSiteFetch, scrapeGoogleNewsSite, scrapeGoogleSiteFetch } from './lib.mjs'

const PAGE_TIMEOUT_MS = 25_000
const SCROLL_PAUSE_MS = 800

function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

export async function launchBrowser() {
  if (isServerless()) {
    const chromiumPkg = await import('@sparticuz/chromium')
    const { chromium } = await import('playwright-core')
    return chromium.launch({
      args: chromiumPkg.default.args,
      executablePath: await chromiumPkg.default.executablePath(),
      headless: chromiumPkg.default.headless ?? true,
    })
  }

  try {
    const { chromium } = await import('playwright')
    return chromium.launch({ headless: true })
  } catch {
    const { chromium } = await import('playwright-core')
    return chromium.launch({ headless: true, channel: 'chromium' })
  }
}

export async function withBrowser(fn) {
  const browser = await launchBrowser()
  try {
    const context = await browser.newContext({
      userAgent: DEFAULT_UA,
      locale: 'ja-JP',
      viewport: { width: 1280, height: 900 },
    })
    const page = await context.newPage()
    page.setDefaultTimeout(PAGE_TIMEOUT_MS)
    return await fn(page, context)
  } finally {
    await browser.close()
  }
}

function normalizeText(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function itemFromPost({ platform, keyword, text, url, publishedAt = null, raw = {} }) {
  const body = normalizeText(text)
  if (!body || body.length < 8) return null
  const fromText = matchKeywords(body, SNS_KEYWORDS)
  const fromQuery = SNS_KEYWORDS.filter(
    (k) => k === keyword || body.toLowerCase().includes(k.toLowerCase()),
  )
  const matchedKeywords = [...new Set([...fromText, ...fromQuery, ...(SNS_KEYWORDS.includes(keyword) ? [keyword] : [])])]
  if (matchedKeywords.length === 0) return null
  return {
    externalId: hashId(`${platform}:${url || body.slice(0, 120)}`),
    title: body.slice(0, 200),
    url,
    snippet: body.slice(0, 1000),
    publishedAt,
    matchedKeywords: matchedKeywords,
    raw: { platform, keyword, ...raw },
  }
}

async function detectLoginWall(page) {
  const body = await page.locator('body').innerText().catch(() => '')
  return /log in|ログイン|サインイン|sign up to continue|アカウントを作成/i.test(body.slice(0, 2000))
}

async function gentleScroll(page, times = 2) {
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, 1200)
    await page.waitForTimeout(SCROLL_PAUSE_MS)
  }
}

function dedupeItems(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = item.url || item.externalId
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function scrapeGoogleSiteSearch(page, keyword, { siteQuery, urlPattern, platform }) {
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(siteQuery(keyword))}&hl=ja&num=20`
  try {
    await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
    await page.waitForTimeout(2000)
    const googleHits = await page.evaluate((pattern) => {
      const urlTest = new RegExp(pattern, 'i')
      const out = []
      const seen = new Set()
      document.querySelectorAll('#search a[href], #rso a[href], div.g a[href], a[href]').forEach((a) => {
        let href = a.href || ''
        if (!href || href.includes('google.com/search') || href.includes('accounts.google')) return
        href = href.split('&')[0].split('#')[0]
        if (!urlTest.test(href)) return
        if (seen.has(href)) return
        seen.add(href)
        const block = a.closest('[data-sokoban-container], div.g, div[data-hveid], li, div')
        const h3 = block?.querySelector('h3')
        const text = (h3?.textContent || block?.textContent || a.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
        if (text.length > 10) out.push({ text, url: href, publishedAt: null })
      })
      return out.slice(0, 20)
    }, urlPattern.source ?? String(urlPattern))
    return googleHits
      .map((p) =>
        itemFromPost({
          platform,
          keyword,
          text: p.text,
          url: p.url,
          publishedAt: p.publishedAt,
          raw: { via: 'google' },
        }),
      )
      .filter(Boolean)
  } catch {
    return []
  }
}

async function searchFallbackForSocial(page, keyword, {
  siteQuery,
  urlPattern,
  platform,
  linkIncludes,
  ddgPattern,
  newsSiteDomain,
}) {
  const mapFetch = (fetchRaw) =>
    fetchRaw
      .map((r) =>
        itemFromPost({
          platform,
          keyword,
          text: `${r.title} ${r.snippet}`,
          url: r.url,
          publishedAt: r.publishedAt,
          raw: r.raw ?? { via: 'search-fetch' },
        }),
      )
      .filter(Boolean)

  if (newsSiteDomain) {
    try {
      const newsRaw = await scrapeGoogleNewsSite(keyword, {
        siteDomain: newsSiteDomain,
      })
      const newsItems = mapFetch(newsRaw)
      if (newsItems.length > 0) return newsItems
    } catch {
      // google news rss unavailable
    }
  }

  const playwrightItems = await scrapeGoogleSiteSearch(page, keyword, {
    siteQuery,
    urlPattern,
    platform,
  })
  if (playwrightItems.length > 0) return playwrightItems

  try {
    const googleRaw = await scrapeGoogleSiteFetch(keyword, {
      buildQuery: siteQuery,
      linkIncludes,
      urlPattern,
    })
    const googleItems = mapFetch(googleRaw)
    if (googleItems.length > 0) return googleItems
  } catch {
    // google fetch blocked
  }

  try {
    const ddgRaw = await scrapeDdgSiteFetch(keyword, {
      buildQuery: siteQuery,
      linkIncludes,
      urlPattern: ddgPattern ?? urlPattern,
    })
    return mapFetch(ddgRaw)
  } catch {
    return []
  }
}

async function scrapeX(page, keyword) {
  const items = []
  let loginWall = false

  const xUrl = `https://x.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`
  await page.goto(xUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
  await page.waitForTimeout(2500)
  if (await detectLoginWall(page)) loginWall = true
  await gentleScroll(page, 2)

  const tweets = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('[data-testid="tweet"]').forEach((tweet) => {
      const text = tweet.querySelector('[data-testid="tweetText"]')?.textContent?.trim() ?? ''
      const href = tweet.querySelector('a[href*="/status/"]')?.getAttribute('href')
      const postUrl = href ? new URL(href, 'https://x.com').toString() : null
      const publishedAt = tweet.querySelector('time')?.getAttribute('datetime') ?? null
      if (text) out.push({ text, url: postUrl, publishedAt })
    })
    return out.slice(0, 20)
  })

  for (const p of tweets) {
    const item = itemFromPost({ platform: 'x', keyword, text: p.text, url: p.url, publishedAt: p.publishedAt })
    if (item) items.push(item)
  }

  if (items.length === 0) {
    const nitterUrl = `https://nitter.poast.org/search?f=tweets&q=${encodeURIComponent(keyword)}`
    try {
      await page.goto(nitterUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
      await page.waitForTimeout(2000)
      const nitterPosts = await page.evaluate(() => {
        const out = []
        document.querySelectorAll('.timeline-item, .tweet-body').forEach((el) => {
          const container = el.closest('.timeline-item') ?? el
          const text =
            container.querySelector('.tweet-content')?.textContent?.trim() ??
            el.textContent?.trim() ??
            ''
          const link = container.querySelector('a[href*="/status/"]')?.getAttribute('href')
          const postUrl = link
            ? link.startsWith('http')
              ? link.replace(/nitter\.[^/]+/, 'x.com')
              : `https://x.com${link.replace(/^\/[^/]+/, '')}`
            : null
          if (text.length > 8) out.push({ text, url: postUrl, publishedAt: null })
        })
        return out.slice(0, 20)
      })
      for (const p of nitterPosts) {
        const item = itemFromPost({ platform: 'x', keyword, text: p.text, url: p.url, raw: { via: 'nitter' } })
        if (item) items.push(item)
      }
    } catch {
      // nitter mirror unavailable
    }
  }

  if (items.length === 0) {
    const googleItems = await searchFallbackForSocial(page, keyword, {
      siteQuery: (k) => `site:x.com ${k}`,
      urlPattern: /\/status\//,
      platform: 'x',
      linkIncludes: ['x.com', 'twitter.com'],
    })
    items.push(...googleItems)
  }

  return { items: dedupeItems(items), loginWall: loginWall && items.length === 0 }
}

async function scrapeInstagram(page, keyword) {
  const items = await searchFallbackForSocial(page, keyword, {
    siteQuery: (k) => `(site:instagram.com OR site:instagr.am) ${k}`,
    urlPattern: /instagram\.com\/(p|reel|tv)\//,
    ddgPattern: /instagram\.com\//,
    newsSiteDomain: 'instagram.com',
    platform: 'instagram',
    linkIncludes: ['instagram.com', 'instagr.am'],
  })
  return { items: dedupeItems(items), loginWall: items.length === 0 }
}

async function scrapeThreads(page, keyword) {
  const url = `https://www.threads.net/search?q=${encodeURIComponent(keyword)}&serp_type=default`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
  await page.waitForTimeout(2500)
  const loginWall = await detectLoginWall(page)
  if (loginWall) {
    const googleItems = await searchFallbackForSocial(page, keyword, {
      siteQuery: (k) => `site:threads.net ${k}`,
      urlPattern: /threads\.net\/.*\/post\//,
      ddgPattern: /threads\.net\//,
      platform: 'threads',
      linkIncludes: ['threads.net'],
    })
    return {
      items: dedupeItems(googleItems),
      loginWall: googleItems.length === 0,
    }
  }
  await gentleScroll(page, 2)

  const posts = await page.evaluate(() => {
    const out = []
    const links = document.querySelectorAll('a[href*="/post/"]')
    links.forEach((a) => {
      const href = a.getAttribute('href')
      const postUrl = href ? new URL(href, 'https://www.threads.net').toString() : null
      const container = a.closest('div[dir="auto"]')?.parentElement ?? a.closest('article') ?? a
      const text = container?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      if (text.length > 12) out.push({ text, url: postUrl })
    })
    if (out.length === 0) {
      document.querySelectorAll('[data-pressable-container="true"]').forEach((el) => {
        const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
        const link = el.querySelector('a[href*="/post/"]')?.getAttribute('href')
        const postUrl = link ? new URL(link, 'https://www.threads.net').toString() : null
        if (text.length > 12) out.push({ text, url: postUrl })
      })
    }
    return out.slice(0, 20)
  })

  const items = posts
    .map((p) => itemFromPost({ platform: 'threads', keyword, text: p.text, url: p.url }))
    .filter(Boolean)

  if (items.length === 0) {
    const googleItems = await searchFallbackForSocial(page, keyword, {
      siteQuery: (k) => `site:threads.net ${k}`,
      urlPattern: /threads\.net\/.*\/post\//,
      ddgPattern: /threads\.net\//,
      platform: 'threads',
      linkIncludes: ['threads.net'],
    })
    items.push(...googleItems)
  }

  return { items: dedupeItems(items), loginWall: false }
}

async function scrapeFacebook(page, keyword) {
  const items = await searchFallbackForSocial(page, keyword, {
    siteQuery: (k) => `(site:facebook.com OR site:fb.com) ${k}`,
    urlPattern: /facebook\.com\/(posts|groups|events|photo|watch|permalink|story|share|videos)/,
    ddgPattern: /facebook\.com\//,
    newsSiteDomain: 'facebook.com',
    platform: 'facebook',
    linkIncludes: ['facebook.com', 'fb.com'],
  })
  return { items: dedupeItems(items), loginWall: items.length === 0 }
}

const SCRAPERS = {
  twitter: scrapeX,
  instagram: scrapeInstagram,
  threads: scrapeThreads,
  facebook: scrapeFacebook,
}

export async function runPlaywrightSocialSource(sourceId) {
  const scrape = SCRAPERS[sourceId]
  if (!scrape) throw new Error(`Unknown social source: ${sourceId}`)

  return withBrowser(async (page) => {
    const all = []
    let loginWallHit = false

    for (const keyword of SNS_KEYWORDS) {
      try {
        const { items, loginWall } = await scrape(page, keyword)
        if (loginWall) loginWallHit = true
        all.push(...items)
      } catch (err) {
        console.warn(`[${sourceId}] skip "${keyword}":`, err instanceof Error ? err.message : err)
      }
    }

    if (all.length === 0 && loginWallHit) {
      return {
        skipped: true,
        reason: 'ログインウォールにより公開投稿を取得できませんでした',
      }
    }

    return dedupeItems(all)
  })
}

export async function runAllPlaywrightSocialSources(sourceIds = ['twitter', 'instagram', 'threads']) {
  return withBrowser(async (page) => {
    const results = {}
    for (const sourceId of sourceIds) {
      const scrape = SCRAPERS[sourceId]
      if (!scrape) continue
      const all = []
      let loginWallHit = false
      for (const keyword of SNS_KEYWORDS) {
        try {
          const { items, loginWall } = await scrape(page, keyword)
          if (loginWall) loginWallHit = true
          all.push(...items)
        } catch (err) {
          console.warn(`[${sourceId}] skip "${keyword}":`, err instanceof Error ? err.message : err)
        }
      }
      results[sourceId] = {
        items: dedupeItems(all),
        skipped: all.length === 0 && loginWallHit,
        reason:
          all.length === 0 && loginWallHit
            ? 'ログインウォールにより公開投稿を取得できませんでした'
            : null,
      }
    }
    return results
  })
}
