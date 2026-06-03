export type UrlAvailability = 'loading' | 'available' | 'unavailable' | 'unknown'

type CheckResponse = {
  url: string
  unavailable?: boolean
  unknown?: boolean
}

const cache = new Map<string, UrlAvailability>()
const inflight = new Map<string, Promise<UrlAvailability>>()

function isBrokenUrl(url: string): boolean {
  if (!url.trim()) return true
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true
    if (/google\.com\/search|duckduckgo\.com\/html/i.test(url)) return true
    return false
  } catch {
    return true
  }
}

function toAvailability(result: CheckResponse): UrlAvailability {
  if (result.unavailable) return 'unavailable'
  if (result.unknown) return 'unknown'
  return 'available'
}

async function requestCheck(url: string): Promise<UrlAvailability> {
  try {
    const res = await fetch(`/api/check-url?url=${encodeURIComponent(url)}`)
    if (!res.ok) return 'unknown'
    const data = (await res.json()) as CheckResponse
    return toAvailability(data)
  } catch {
    return 'unknown'
  }
}

export function getCachedUrlAvailability(url: string): UrlAvailability | undefined {
  return cache.get(url)
}

export async function checkUrlAvailability(url: string): Promise<UrlAvailability> {
  if (isBrokenUrl(url)) {
    cache.set(url, 'unavailable')
    return 'unavailable'
  }

  const cached = cache.get(url)
  if (cached) return cached

  const pending = inflight.get(url)
  if (pending) return pending

  const promise = requestCheck(url).then((result) => {
    cache.set(url, result)
    inflight.delete(url)
    return result
  })
  inflight.set(url, promise)
  return promise
}

export async function checkUrlAvailabilityBatch(urls: string[]): Promise<Map<string, UrlAvailability>> {
  const unique = [...new Set(urls.filter(Boolean))]
  const result = new Map<string, UrlAvailability>()

  const missing = unique.filter((url) => {
    if (isBrokenUrl(url)) {
      result.set(url, 'unavailable')
      cache.set(url, 'unavailable')
      return false
    }
    const cached = cache.get(url)
    if (cached) {
      result.set(url, cached)
      return false
    }
    return true
  })

  if (missing.length === 0) return result

  try {
    const res = await fetch('/api/check-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: missing.slice(0, 25) }),
    })
    if (res.ok) {
      const data = (await res.json()) as { results?: CheckResponse[] }
      for (const item of data.results ?? []) {
        const availability = toAvailability(item)
        cache.set(item.url, availability)
        result.set(item.url, availability)
      }
    }
  } catch {
    // fall through — mark unchecked as unknown
  }

  for (const url of missing) {
    if (!result.has(url)) {
      const availability = await checkUrlAvailability(url)
      result.set(url, availability)
    }
  }

  return result
}
