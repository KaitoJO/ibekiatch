import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, MapPin, Sparkles, X } from 'lucide-react'
import { formatDate } from '../../lib/recruitmentUtils'
import { getSourceLabel } from '../../lib/sourceTheme'
import { formatPrefectureDisplay, formatVenueDisplay } from '../../lib/prefectureResolve'
import {
  clearPendingApplyPrompt,
  getPendingApplyPrompt,
  resolveMyEventRefKey,
  setPendingApplyPrompt,
} from '../../lib/myEvents'
import { ScreenHeader } from '../shared/ScreenHeader'
import type { DisplayEvent, MyEventRecord } from '../../types'
import '../shared/shared.css'
import './home.css'

type Props = {
  event: DisplayEvent
  applied: boolean
  applyBusy: boolean
  confirmBusy?: boolean
  isLoggedIn: boolean
  myEvent: MyEventRecord | null
  onBack: () => void
  onApply: () => void
  onConfirmShop?: () => void
  onRecordView: (event: DisplayEvent) => Promise<void>
  onMarkMyEventApplied: (event: DisplayEvent) => Promise<MyEventRecord | null>
}

export function EventDetailScreen({
  event,
  applied,
  applyBusy,
  confirmBusy = false,
  isLoggedIn,
  myEvent,
  onBack,
  onApply,
  onConfirmShop,
  onRecordView,
  onMarkMyEventApplied,
}: Props) {
  const isHost = event.origin === 'host'
  const isFull = isHost && event.maxApplicants > 0 && event.applicants >= event.maxApplicants
  const progress =
    isHost && event.maxApplicants > 0 ? (event.applicants / event.maxApplicants) * 100 : 0
  const sourceLabel = getSourceLabel(event.sourceId)
  const externalUrl = event.applicationUrl || event.sourceUrl
  const venueLabel = formatVenueDisplay(event.location, event.prefecture, event.area, event.title) || '場所要確認'
  const prefectureLabel = formatPrefectureDisplay(event.prefecture, event.area, event.location, event.title)
  const eventRefKey = resolveMyEventRefKey(event)

  const [localMyEvent, setLocalMyEvent] = useState<MyEventRecord | null>(myEvent)
  const [applyPromptOpen, setApplyPromptOpen] = useState(false)
  const [applyPromptBusy, setApplyPromptBusy] = useState(false)
  const recordedRef = useRef(false)
  const wentExternalRef = useRef(false)

  useEffect(() => {
    setLocalMyEvent(myEvent)
  }, [myEvent])

  useEffect(() => {
    if (!isLoggedIn || recordedRef.current) return
    recordedRef.current = true
    void onRecordView(event)
  }, [event, isLoggedIn, onRecordView])

  const maybeShowApplyPrompt = useCallback(() => {
    const pendingRef = getPendingApplyPrompt()
    if (!pendingRef || !wentExternalRef.current) return
    if (pendingRef !== eventRefKey) return
    setApplyPromptOpen(true)
    clearPendingApplyPrompt()
    wentExternalRef.current = false
  }, [eventRefKey])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        maybeShowApplyPrompt()
      }
    }
    const onFocus = () => {
      maybeShowApplyPrompt()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [maybeShowApplyPrompt])

  const openExternalSite = () => {
    if (!externalUrl) return
    setPendingApplyPrompt(eventRefKey)
    wentExternalRef.current = true
    window.open(externalUrl, '_blank', 'noopener,noreferrer')
  }

  const handleApplyPromptYes = async () => {
    setApplyPromptBusy(true)
    try {
      const record = await onMarkMyEventApplied(event)
      if (record) setLocalMyEvent(record)
      setApplyPromptOpen(false)
    } finally {
      setApplyPromptBusy(false)
    }
  }

  const handleApplyPromptDismiss = () => {
    clearPendingApplyPrompt()
    wentExternalRef.current = false
    setApplyPromptOpen(false)
  }

  const ctaLabel = applyBusy
    ? '送信中…'
    : applied
      ? '応募済み'
      : isFull
        ? '満枠'
        : isHost
          ? '応募する'
          : '元サイトを見る'

  const handleCta = () => {
    if (isHost) {
      if (!applied && !isFull) onApply()
      return
    }
    openExternalSite()
  }

  const statusLabel =
    localMyEvent?.status === '応募中'
      ? '応募中'
      : localMyEvent?.status === '出店確定'
        ? '出店確定'
        : null

  return (
    <div className="screen detail-screen">
      <ScreenHeader title="募集詳細" onBack={onBack} gradient />

      <div className="detail-hero" style={{ background: event.imageGradient }}>
        <div className="recruitment-card__badges">
          {event.isNew && (
            <span className="recruitment-card__badge recruitment-card__badge--new">本日の新着</span>
          )}
          {event.isUrgent && (
            <span className="recruitment-card__badge recruitment-card__badge--urgent">急募</span>
          )}
          {statusLabel && (
            <span className="recruitment-card__badge detail-status-badge">{statusLabel}</span>
          )}
          {!isHost && (
            <span className="recruitment-card__badge recruitment-card__badge--ai">
              <Sparkles size={10} style={{ marginRight: 2, verticalAlign: -1 }} />
              AI収集{sourceLabel ? ` · ${sourceLabel}` : ''}
            </span>
          )}
        </div>
        <h2 className="detail-hero__title">{event.title}</h2>
        <p className="detail-hero__genre">{event.category || event.area}</p>
      </div>

      <div className="detail-body">
        {event.organizer && (
          <section className="detail-section">
            <h3 className="detail-section__label">主催</h3>
            <p className="detail-section__text">{event.organizer}</p>
          </section>
        )}

        <section className="detail-section">
          <h3 className="detail-section__label">会場・場所</h3>
          <p className="detail-section__text">
            <MapPin size={16} style={{ verticalAlign: -3, marginRight: 4 }} />
            {venueLabel}
            {prefectureLabel && (
              <>
                <br />
                <strong>{prefectureLabel}</strong>
              </>
            )}
          </p>
        </section>

        <div className="detail-grid">
          <div className="detail-grid__item">
            <div className="detail-grid__label">出店日</div>
            <div className="detail-grid__value">
              {event.eventDate ? formatDate(event.eventDate) : '要確認'}
            </div>
          </div>
          <div className="detail-grid__item">
            <div className="detail-grid__label">{isHost ? '時間' : '募集締切'}</div>
            <div className="detail-grid__value">
              {isHost
                ? event.timeSlot || '—'
                : event.recruitEnd
                  ? formatDate(event.recruitEnd)
                  : '—'}
            </div>
          </div>
        </div>

        <section className="detail-section">
          <h3 className="detail-section__label">出店料</h3>
          <p className="detail-fee">{event.feeLabel}</p>
        </section>

        <section className="detail-section">
          <h3 className="detail-section__label">募集概要</h3>
          <p className="detail-section__text">
            {event.description || '詳細は主催者または元サイトをご確認ください。'}
          </p>
        </section>

        {externalUrl && (
          <a
            className="detail-source-link"
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault()
              openExternalSite()
            }}
          >
            元サイトを見る
            <ExternalLink size={16} />
          </a>
        )}

        {isHost && (
          <section className="detail-section">
            <h3 className="detail-section__label">応募状況</h3>
            <div className="recruitment-card__progress">
              <div
                className="recruitment-card__progress-fill"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="detail-section__sub">
              {event.applicants} / {event.maxApplicants} 枠
              {isFull ? ' — 満枠' : ''}
            </p>
          </section>
        )}

        <button
          type="button"
          className="primary-btn detail-cta"
          disabled={applyBusy || (isHost && (applied || isFull)) || (!isHost && !externalUrl)}
          onClick={handleCta}
        >
          {ctaLabel}
        </button>

        {isHost && applied && onConfirmShop && (
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

      {applyPromptOpen && (
        <div className="apply-prompt-overlay" role="presentation">
          <div className="apply-prompt" role="dialog" aria-labelledby="apply-prompt-title">
            <button
              type="button"
              className="apply-prompt__close"
              aria-label="閉じる"
              disabled={applyPromptBusy}
              onClick={handleApplyPromptDismiss}
            >
              <X size={20} />
            </button>
            <h2 id="apply-prompt-title" className="apply-prompt__title">
              応募しましたか？
            </h2>
            <p className="apply-prompt__body">
              「{event.title.slice(0, 40)}
              {event.title.length > 40 ? '…' : ''}」の外部サイトでの応募状況を教えてください。
            </p>
            <div className="apply-prompt__actions">
              <button
                type="button"
                className="apply-prompt__btn apply-prompt__btn--primary"
                disabled={applyPromptBusy}
                onClick={() => void handleApplyPromptYes()}
              >
                はい・応募した
              </button>
              <button
                type="button"
                className="apply-prompt__btn apply-prompt__btn--text"
                disabled={applyPromptBusy}
                onClick={handleApplyPromptDismiss}
              >
                いいえ・やめた
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
