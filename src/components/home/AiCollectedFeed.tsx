import { Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { filterActiveMonitorHits } from '../../lib/recruitmentStatus'
import type { MonitorHit } from '../../types'
import type { UrlAvailability } from '../../lib/urlAvailability'
import { checkUrlAvailabilityBatch, getCachedUrlAvailability } from '../../lib/urlAvailability'
import { SourceLink } from '../shared/SourceLink'
import './ai-feed.css'

const SOURCE_LABELS: Record<string, string> = {
  kokuchiz: 'こくちーず',
  peatix: 'Peatix',
  google_news: 'Googleニュース',
  jmty: 'ジモティー',
  twitter: 'X',
  instagram: 'Instagram',
  threads: 'Threads',
  mie_cities: '市町村HP',
  shokokai: '商工会',
  michinoeki: '道の駅',
  eventbank: 'イベントバンク',
  maipure_mie: 'まいぷれ三重',
  mellow_shopstop: 'MELLOW SHOP STOP',
  mobimaru: 'Mobimaru',
  kitchencar_madoguchi: 'キッチンカーの窓口',
  aeon_mall: 'イオンモール',
  outlet_mall: 'アウトレット',
  mie_tourism: '観光協会',
  mie_news: '新聞',
  mie_fm: '三重FM',
  ja_mie: 'JA三重',
  facebook: 'Facebook',
}

const PAID_DISPLAY_LIMIT = 100

type Props = {
  hits: MonitorHit[]
  limit?: number
  includeClosed?: boolean
  onUpgrade?: () => void
}

export function AiCollectedFeed({ hits, limit, includeClosed = false, onUpgrade }: Props) {
  const activeHits = useMemo(
    () => (includeClosed ? hits : filterActiveMonitorHits(hits)),
    [hits, includeClosed],
  )
  const displayLimit = limit ?? PAID_DISPLAY_LIMIT
  const visible = activeHits.slice(0, displayLimit)
  const hiddenCount = Math.max(0, activeHits.length - displayLimit)
  const urls = useMemo(
    () => visible.map((hit) => hit.url).filter((url): url is string => Boolean(url)).slice(0, 20),
    [visible],
  )
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, UrlAvailability>>(() => {
    const initial = new Map<string, UrlAvailability>()
    for (const url of urls) {
      const cached = getCachedUrlAvailability(url)
      if (cached) initial.set(url, cached)
    }
    return initial
  })

  useEffect(() => {
    let cancelled = false
    if (urls.length === 0) return
    if (urls.every((url) => getCachedUrlAvailability(url))) {
      const cached = new Map<string, UrlAvailability>()
      for (const url of urls) {
        const hit = getCachedUrlAvailability(url)
        if (hit) cached.set(url, hit)
      }
      setAvailabilityMap(cached)
      return
    }
    checkUrlAvailabilityBatch(urls).then((map) => {
      if (!cancelled) setAvailabilityMap(map)
    })
    return () => {
      cancelled = true
    }
  }, [urls])

  return (
    <section className={`ai-feed${activeHits.length === 0 ? ' ai-feed--empty' : ''}`}>
      <div className="ai-feed__header">
        <Sparkles size={18} className="ai-feed__icon" />
        <div>
          <h2 className="ai-feed__title">AI収集の新着</h2>
          <p className="ai-feed__sub">
            {activeHits.length > 0
              ? `${activeHits.length}件 · 21ソースから自動収集${includeClosed ? '（テスト: 終了済み含む）' : '（募集中のみ）'}`
              : '21ソースから1時間ごとに自動収集中'}
          </p>
        </div>
      </div>

      {activeHits.length === 0 ? (
        <p className="ai-feed__empty-text">新着情報が入るとここに表示されます。</p>
      ) : (
        <>
          <ul className="ai-feed__list">
            {visible.map((hit) => (
              <li key={hit.id} className="ai-feed__item">
                <div className="ai-feed__item-meta">
                  <span className="ai-feed__badge">AI収集</span>
                  <span className="ai-feed__source">{SOURCE_LABELS[hit.sourceId] ?? hit.sourceId}</span>
                </div>
                <h3 className="ai-feed__item-title">{hit.title}</h3>
                {hit.snippet && <p className="ai-feed__item-snippet">{hit.snippet}</p>}
                <div className="ai-feed__keywords">
                  {hit.matchedKeywords.slice(0, 3).map((k) => (
                    <span key={k} className="ai-feed__keyword">{k}</span>
                  ))}
                </div>
                {hit.url && (
                  <SourceLink
                    className="ai-feed__link"
                    url={hit.url}
                    availability={availabilityMap.get(hit.url)}
                  />
                )}
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && limit != null && onUpgrade && (
            <button type="button" className="ai-feed__upgrade" onClick={onUpgrade}>
              あと{hiddenCount}件 — スタンダードプランで全件表示
            </button>
          )}
          {hiddenCount > 0 && limit == null && (
            <p className="ai-feed__empty-text" style={{ marginTop: 12 }}>
              他 {hiddenCount} 件の新着があります（表示は最新 {PAID_DISPLAY_LIMIT} 件）
            </p>
          )}
        </>
      )}
    </section>
  )
}
