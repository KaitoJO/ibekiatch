import { ExternalLink, Sparkles } from 'lucide-react'
import type { MonitorHit } from '../../types'
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

type Props = {
  hits: MonitorHit[]
  limit?: number
  onUpgrade?: () => void
}

export function AiCollectedFeed({ hits, limit, onUpgrade }: Props) {
  const visible = limit ? hits.slice(0, limit) : hits
  const hiddenCount = limit ? Math.max(0, hits.length - limit) : 0

  if (hits.length === 0) {
    return (
      <section className="ai-feed ai-feed--empty">
        <div className="ai-feed__header">
          <Sparkles size={18} className="ai-feed__icon" />
          <div>
            <h2 className="ai-feed__title">AI収集の新着</h2>
            <p className="ai-feed__sub">21ソースから1時間ごとに自動収集中</p>
          </div>
        </div>
        <p className="ai-feed__empty-text">新着情報が入るとここに表示されます。</p>
      </section>
    )
  }

  return (
    <section className="ai-feed">
      <div className="ai-feed__header">
        <Sparkles size={18} className="ai-feed__icon" />
        <div>
          <h2 className="ai-feed__title">AI収集の新着</h2>
          <p className="ai-feed__sub">{hits.length}件 · 21ソースから自動収集</p>
        </div>
      </div>

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
              <a
                className="ai-feed__link"
                href={hit.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                元サイトを見る
                <ExternalLink size={14} />
              </a>
            )}
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button type="button" className="ai-feed__upgrade" onClick={onUpgrade}>
          あと{hiddenCount}件 — スタンダードプランで全件表示
        </button>
      )}
    </section>
  )
}
