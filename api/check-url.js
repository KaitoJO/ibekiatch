const CHECK_UA =
  'Mozilla/5.0 (compatible; ibekiatch-link-check/1.0; +https://ibekiatch.vercel.app)'
const TIMEOUT_MS = 8000
const MAX_URLS = 25

const NOT_FOUND_BODY = [
  /404\s*not\s*found/i,
  /page\s+not\s+found/i,
  /\bnot\s+found\b/i,
  /ページが見つかりません/,
  /お探しのページは見つかりません/,
  /指定されたページは存在しません/,
  /このページは存在しません/,
  /アクセスしようとしたページは見つかりません/,
]

function isHttpUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function isUnavailableStatus(status) {
  return status === 404 || status === 410
}

function bodyLooksNotFound(text) {
  const sample = (text ?? '').slice(0, 4096)
  return NOT_FOUND_BODY.some((re) => re.test(sample))
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function checkOneUrl(url) {
  if (!isHttpUrl(url)) {
    return { url, ok: false, unavailable: true, status: null, reason: 'invalid_url' }
  }

  try {
    let res = await fetchWithTimeout(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': CHECK_UA },
    })

    if (res.status === 405 || res.status === 501 || res.status === 403) {
      res = await fetchWithTimeout(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': CHECK_UA,
          Range: 'bytes=0-4095',
        },
      })
    }

    if (isUnavailableStatus(res.status)) {
      return { url, ok: false, unavailable: true, status: res.status, reason: 'http_status' }
    }

    if (res.status >= 400) {
      return { url, ok: true, unavailable: false, status: res.status, unknown: true }
    }

    if (res.status === 200 && res.headers.get('content-type')?.includes('text/html')) {
      const text = await res.text()
      if (bodyLooksNotFound(text)) {
        return { url, ok: false, unavailable: true, status: res.status, reason: 'not_found_body' }
      }
    }

    return { url, ok: true, unavailable: false, status: res.status }
  } catch {
    return { url, ok: true, unavailable: false, status: null, unknown: true }
  }
}

function readUrls(req) {
  const host = req.headers.host || 'localhost'
  const parsed = new URL(req.url ?? '/', `https://${host}`)

  if (req.method === 'GET') {
    const single = parsed.searchParams.get('url')?.trim()
    return single ? [single] : []
  }

  const body = req.body
  if (typeof body === 'string') {
    try {
      const json = JSON.parse(body)
      return Array.isArray(json.urls) ? json.urls : []
    } catch {
      return []
    }
  }

  if (body && Array.isArray(body.urls)) {
    return body.urls
  }

  return []
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  const urls = readUrls(req)
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_URLS)

  if (urls.length === 0) {
    return res.status(400).json({ ok: false, error: 'url or urls is required' })
  }

  const results = await Promise.all(urls.map((url) => checkOneUrl(url)))

  if (req.method === 'GET' && results.length === 1) {
    return res.status(200).json({ ok: true, ...results[0] })
  }

  return res.status(200).json({ ok: true, results })
}
