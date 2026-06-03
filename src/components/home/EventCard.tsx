import { MapPin, Sparkles } from 'lucide-react'
import { formatDate } from '../../lib/recruitmentUtils'
import type { DisplayEvent } from '../../types'

const SOURCE_LABELS: Record<string, string> = {
  kokuchiz: 'こくちーず',
  peatix: 'Peatix',
  twitter: 'X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  mie_cities: '市役所HP',
  shokokai: '商工会',
  michinoeki: '道の駅',
  eventbank: 'イベントバンク',
  mie_tourism: '観光協会',
  ja_mie: 'JA三重',
}

type Props = {
  event: DisplayEvent
  applied?: boolean
  applyBusy?: boolean
  onOpen?: () => void
  onApply?: () => void
}

export function EventCard({ event, applied = false, applyBusy = false, onOpen, onApply }: Props) {
  const isHost = event.origin === 'host'
  const isFull = isHost && event.maxApplicants > 0 && event.applicants >= event.maxApplicants
  const sourceLabel = event.sourceId ? SOURCE_LABELS[event.sourceId] ?? event.sourceId : null

  const ctaLabel = applyBusy
    ? '送信中…'
    : applied
      ? '応募済み'
      : isFull
        ? '詳細'
        : isHost
          ? '応募する'
          : '詳細'

  const handleCta = () => {
    if (isHost && !isFull && !applied) onApply?.()
    else onOpen?.()
  }

  return (
    <article className="recruitment-card">
      <button type="button" className="recruitment-card__main" onClick={onOpen}>
        <div className="recruitment-card__hero" style={{ background: event.imageGradient }}>
          <div className="recruitment-card__badges">
            {event.isNew && (
              <span className="recruitment-card__badge recruitment-card__badge--new">本日の新着</span>
            )}
            {event.isUrgent && (
              <span className="recruitment-card__badge recruitment-card__badge--urgent">急募</span>
            )}
            {!isHost && (
              <span className="recruitment-card__badge recruitment-card__badge--ai">
                <Sparkles size={10} style={{ marginRight: 2, verticalAlign: -1 }} />
                AI収集
              </span>
            )}
          </div>
          <span className="recruitment-card__genre">{event.area}</span>
        </div>

        <div className="recruitment-card__body">
          <h3 className="recruitment-card__title">{event.title}</h3>
          <p className="recruitment-card__venue">
            <MapPin size={14} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              {event.location}
              <br />
              <strong>{event.category || event.area}</strong>
              {sourceLabel ? ` · ${sourceLabel}` : ''}
            </span>
          </p>

          <div className="recruitment-card__meta">
            <div className="recruitment-card__meta-item">
              <div className="recruitment-card__meta-label">出店日</div>
              <div className="recruitment-card__meta-value">
                {event.eventDate ? formatDate(event.eventDate) : '要確認'}
              </div>
            </div>
            <div className="recruitment-card__meta-item">
              <div className="recruitment-card__meta-label">{isHost ? '時間' : '締切'}</div>
              <div className="recruitment-card__meta-value">
                {isHost
                  ? event.timeSlot || '—'
                  : event.recruitEnd
                    ? formatDate(event.recruitEnd)
                    : '—'}
              </div>
            </div>
          </div>

          <div className="recruitment-card__meta-item" style={{ gridColumn: '1 / -1' }}>
            <div className="recruitment-card__meta-label">出店料</div>
            <div className="recruitment-card__fee">{event.feeLabel}</div>
          </div>
        </div>
      </button>

      <button
        type="button"
        className="recruitment-card__cta"
        disabled={applyBusy || (isHost && applied)}
        onClick={handleCta}
      >
        {ctaLabel}
      </button>
    </article>
  )
}
