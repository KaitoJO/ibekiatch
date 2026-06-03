import { ExternalLink, MapPin } from 'lucide-react'
import { formatDate, formatFee } from '../../lib/recruitmentUtils'
import type { Recruitment } from '../../types'

type Props = {
  recruitment: Recruitment
  applied?: boolean
  applyBusy?: boolean
  onOpen?: () => void
  onApply?: () => void
}

export function RecruitmentCard({
  recruitment,
  applied = false,
  applyBusy = false,
  onOpen,
  onApply,
}: Props) {
  const progress =
    recruitment.maxApplicants > 0
      ? (recruitment.applicants / recruitment.maxApplicants) * 100
      : 0
  const isFull = recruitment.applicants >= recruitment.maxApplicants

  const ctaLabel = applyBusy
    ? '送信中…'
    : applied
      ? '応募済み'
      : isFull
        ? '詳細'
        : '応募する'

  const handleCta = () => {
    if (isFull || applied) onOpen?.()
    else onApply?.()
  }

  return (
    <article className="recruitment-card">
      <button type="button" className="recruitment-card__main" onClick={onOpen}>
        <div className="recruitment-card__hero" style={{ background: recruitment.imageGradient }}>
          <div className="recruitment-card__badges">
            {recruitment.isNew && (
              <span className="recruitment-card__badge recruitment-card__badge--new">本日の新着</span>
            )}
            {recruitment.isUrgent && (
              <span className="recruitment-card__badge recruitment-card__badge--urgent">急募</span>
            )}
          </div>
          <span className="recruitment-card__genre">{recruitment.area}</span>
        </div>

        <div className="recruitment-card__body">
          <h3 className="recruitment-card__title">{recruitment.title}</h3>
          <p className="recruitment-card__venue">
            <MapPin size={14} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              {recruitment.venue}
              <br />
              <strong>{recruitment.area}</strong>
            </span>
          </p>

          <div className="recruitment-card__meta">
            <div className="recruitment-card__meta-item">
              <div className="recruitment-card__meta-label">出店日</div>
              <div className="recruitment-card__meta-value">{formatDate(recruitment.date)}</div>
            </div>
            <div className="recruitment-card__meta-item">
              <div className="recruitment-card__meta-label">時間</div>
              <div className="recruitment-card__meta-value">{recruitment.timeSlot}</div>
            </div>
          </div>

          <div className="recruitment-card__meta-item" style={{ gridColumn: '1 / -1' }}>
            <div className="recruitment-card__meta-label">出店料（税込）</div>
            <div className="recruitment-card__fee">{formatFee(recruitment.fee)}</div>
          </div>

          <div className="recruitment-card__applicants">
            <div className="recruitment-card__applicants-label">応募状況</div>
            <div className="recruitment-card__progress">
              <div
                className="recruitment-card__progress-fill"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="recruitment-card__applicants-text">
              {recruitment.applicants} / {recruitment.maxApplicants} 枠
              {isFull ? ' — 満枠' : ''}
            </div>
          </div>
        </div>
      </button>

      <div className="recruitment-card__footer">
        <div className="recruitment-card__actions">
          {recruitment.sourceUrl && (
            <a
              className="recruitment-card__source-link"
              href={recruitment.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              元サイトを見る
              <ExternalLink size={14} />
            </a>
          )}
          <button
            type="button"
            className="recruitment-card__cta"
            disabled={applyBusy || applied || isFull}
            onClick={handleCta}
            style={applied ? { opacity: 0.75 } : undefined}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </article>
  )
}
