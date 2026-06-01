import { DEFAULT_UA, SNS_KEYWORDS } from './config.mjs'
import { hashId, matchKeywords } from './lib.mjs'

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
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`site:x.com ${keyword}`)}&hl=ja`
    try {
      await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
      await page.waitForTimeout(1500)
      const googleHits = await page.evaluate(() => {
        const out = []
        document.querySelectorAll('a[href*="x.com"], a[href*="twitter.com"]').forEach((a) => {
          const href = a.href
          if (!/\/status\//.test(href)) return
          const block = a.closest('div[data-sokoban-container]') ?? a.parentElement?.parentElement
          const text = block?.textContent?.replace(/\s+/g, ' ').trim() ?? a.textContent?.trim() ?? ''
          if (text.length > 12) out.push({ text, url: href.split('&')[0], publishedAt: null })
        })
        return out.slice(0, 15)
      })
      for (const p of googleHits) {
        const item = itemFromPost({ platform: 'x', keyword, text: p.text, url: p.url, raw: { via: 'google' } })
        if (item) items.push(item)
      }
    } catch {
      // google fallback failed
    }
  }

  return { items: dedupeItems(items), loginWall: loginWall && items.length === 0 }
}

async function scrapeInstagram(page, keyword) {
  const tag = keyword.replace(/\s+/g, '')
  const urls = [
    `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(keyword)}`,
    `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`,
  ]

  const allItems = []
  let loginWall = false

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
    await page.waitForTimeout(2500)
    if (await detectLoginWall(page)) {
      loginWall = true
      continue
    }
    await gentleScroll(page, 2)

    const posts = await page.evaluate(() => {
      const out = []
      const captions = document.querySelectorAll('article img[alt]')
      captions.forEach((img) => {
        const alt = img.getAttribute('alt')?.trim() ?? ''
        const link = img.closest('a')?.getAttribute('href') ?? img.closest('article')?.querySelector('a')?.getAttribute('href')
        const postUrl = link ? new URL(link, 'https://www.instagram.com').toString() : null
        if (alt && alt.length > 10) out.push({ text: alt, url: postUrl })
      })
      if (out.length === 0) {
        document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').forEach((a) => {
          const href = a.getAttribute('href')
          const aria = a.getAttribute('aria-label') ?? ''
          const text = aria || a.textContent?.trim() || ''
          if (text.length > 8) {
            out.push({
              text,
              url: href ? new URL(href, 'https://www.instagram.com').toString() : null,
            })
          }
        })
      }
      return out.slice(0, 20)
    })

    for (const p of posts) {
      const item = itemFromPost({ platform: 'instagram', keyword, text: p.text, url: p.url })
      if (item) allItems.push(item)
    }
  }

  if (allItems.length === 0) {
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com ${keyword}`)}&hl=ja`
    try {
      await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
      await page.waitForTimeout(1500)
      const googleHits = await page.evaluate(() => {
        const out = []
        document.querySelectorAll('a[href*="instagram.com/p/"], a[href*="instagram.com/reel/"]').forEach((a) => {
          const href = a.href.split('&')[0]
          const block = a.closest('div')?.parentElement
          const text = block?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
          if (text.length > 12) out.push({ text, url: href })
        })
        return out.slice(0, 15)
      })
      for (const p of googleHits) {
        const item = itemFromPost({ platform: 'instagram', keyword, text: p.text, url: p.url, raw: { via: 'google' } })
        if (item) allItems.push(item)
      }
    } catch {
      // google fallback failed
    }
  }

  return { items: dedupeItems(allItems), loginWall: loginWall && allItems.length === 0 }
}

async function scrapeThreads(page, keyword) {
  const url = `https://www.threads.net/search?q=${encodeURIComponent(keyword)}&serp_type=default`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
  await page.waitForTimeout(2500)
  if (await detectLoginWall(page)) {
    return { items: [], loginWall: true }
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
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`site:threads.net ${keyword}`)}&hl=ja`
    try {
      await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
      await page.waitForTimeout(1500)
      const googleHits = await page.evaluate(() => {
        const out = []
        document.querySelectorAll('a[href*="threads.net"]').forEach((a) => {
          const href = a.href.split('&')[0]
          if (!/\/post\//.test(href)) return
          const block = a.closest('div')?.parentElement
          const text = block?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
          if (text.length > 12) out.push({ text, url: href })
        })
        return out.slice(0, 15)
      })
      for (const p of googleHits) {
        const item = itemFromPost({ platform: 'threads', keyword, text: p.text, url: p.url, raw: { via: 'google' } })
        if (item) items.push(item)
      }
    } catch {
      // google fallback failed
    }
  }

  return { items: dedupeItems(items), loginWall: false }
}

const SCRAPERS = {
  twitter: scrapeX,
  instagram: scrapeInstagram,
  threads: scrapeThreads,
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
        reason: loginWallHit ? 'ログインウォールにより公開投稿を取得できませんでした' : null,
      }
    }
    return results
  })
}
