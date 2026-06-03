import { useEffect, useState } from 'react'
import {
  checkUrlAvailability,
  getCachedUrlAvailability,
  type UrlAvailability,
} from '../lib/urlAvailability'

export function useUrlAvailability(url: string | null | undefined): UrlAvailability {
  const cached = url ? getCachedUrlAvailability(url) : undefined
  const [status, setStatus] = useState<UrlAvailability>(cached ?? (url ? 'loading' : 'unknown'))

  useEffect(() => {
    if (!url) {
      setStatus('unknown')
      return
    }

    const existing = getCachedUrlAvailability(url)
    if (existing) {
      setStatus(existing)
      return
    }

    let cancelled = false
    setStatus('loading')

    checkUrlAvailability(url).then((next) => {
      if (!cancelled) setStatus(next)
    })

    return () => {
      cancelled = true
    }
  }, [url])

  return status
}
