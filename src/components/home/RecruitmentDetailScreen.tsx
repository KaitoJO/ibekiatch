import { ExternalLink, MapPin } from 'lucide-react'
import { formatDate, formatFee } from '../../lib/recruitmentUtils'
import { ScreenHeader } from '../shared/ScreenHeader'
import type { Recruitment } from '../../types'
import '../shared/shared.css'
import './home.css'

type Props = {
  recruitment: Recruitment
  applied: boolean
  applyBusy: boolean
  confirmBusy?: boolean
  onBack: () => void
  onApply: () => void
  onConfirmShop?: () => void
}

export function RecruitmentDetailScreen({
  recruitment,
  applied,
  applyBusy,
  confirmBusy = false,
  onBack,
  onApply,
  onConfirmShop,
}: Props) {
  const isFull = recruitment.applicants >= recruitment.maxApplicants
  const progress =
    recruitment.maxApplicants > 0
      ? (recruitment.applicants / recruitment.maxApplicants) * 100
      : 0

  const ctaLabel = applyBusy
    ? '送信中…'
    : applied
      ? '応募済み'
      : isFull
        ? '満枠'
        : '応募する'

  return (
    <div className="screen detail-screen">
      <ScreenHeader title="募集詳細" onBack={onBack} gradient />

      <div
        className="detail-hero"
        style={{ background: recruitment.imageGradient }}
      >
        <div className="recruitment-card__badges">
          {recruitment.isNew && (
            <span className="recruitment-card__badge recruitment-card__badge--new">本日の新着</span>
          )}
          {recruitment.isUrgent && (
            <span className="recruitment-card__badge recruitment-card__badge--urgent">急募</span>
          )}
        </div>
        <h2 className="detail-hero__title">{recruitment.title}</h2>
        <p className="detail-hero__genre">{recruitment.genre}</p>
      </div>

      <div className="detail-body">
        <section className="detail-section">
          <h3 className="detail-section__label">会場</h3>
          <p className="detail-section__text">
            <MapPin size={16} style={{ verticalAlign: -3, marginRight: 4 }} />
            {recruitment.venue}
            <br />
            <strong>{recruitment.area}</strong>
          </p>
        </section>

        <div className="detail-grid">
          <div className="detail-grid__item">
            <div className="detail-grid__label">出店日</div>
            <div className="detail-grid__value">{formatDate(recruitment.date)}</div>
          </div>
          <div className="detail-grid__item">
            <div className="detail-grid__label">時間</div>
            <div className="detail-grid__value">{recruitment.timeSlot}</div>
          </div>
        </div>

        <section className="detail-section">
          <h3 className="detail-section__label">出店料（税込）</h3>
          <p className="detail-fee">{formatFee(recruitment.fee)}</p>
        </section>

        <section className="detail-section">
          <h3 className="detail-section__label">募集概要</h3>
          <p className="detail-section__text">
            {recruitment.description || '詳細は主催者にお問い合わせください。'}
          </p>
        </section>

        {recruitment.sourceUrl && (
          <a
            className="detail-source-link"
            href={recruitment.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            元サイトを見る
            <ExternalLink size={16} />
          </a>
        )}

        <section className="detail-section">
          <h3 className="detail-section__label">応募状況</h3>
          <div className="recruitment-card__progress">
            <div
              className="recruitment-card__progress-fill"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="detail-section__sub">
            {recruitment.applicants} / {recruitment.maxApplicants} 枠
            {isFull ? ' — 満枠' : ''}
          </p>
        </section>

        <button
          type="button"
          className="primary-btn detail-cta"
          disabled={applyBusy || applied || isFull}
          onClick={onApply}
        >
          {ctaLabel}
        </button>

        {applied && onConfirmShop && (
          <button
            type="button"
            className="primary-btn detail-cta detail-cta--confirm"
            disabled={confirmBusy}
            onClick={onConfirmShop}
          >
            {confirmBusy ? '処理中…' : '出店確定'}
          </button>
        )}
      </div>
    </div>
  )
}
