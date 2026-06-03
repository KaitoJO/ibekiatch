import { Sparkles } from 'lucide-react'
import { getEventHeroBackground, getSourceLabel } from '../../lib/sourceTheme'
import { formatPrefectureDisplay, formatVenueDisplay } from '../../lib/prefectureResolve'
import { formatDate } from '../../lib/recruitmentUtils'
import { todayInJstDateKey } from '../../lib/recruitmentStatus'
import type { DisplayEvent } from '../../types'

type Props = {
  event: DisplayEvent
  onOpen?: () => void
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function deadlineBadge(event: DisplayEvent): { text: string; urgent: boolean } | null {
  if (event.isUrgent) return { text: '急募', urgent: true }
  if (!event.recruitEnd) return null
  const today = todayInJstDateKey()
  if (event.recruitEnd < today) return null
  return { text: `締切 ${formatShortDate(event.recruitEnd)}`, urgent: false }
}

export function EventCard({ event, onOpen }: Props) {
  const isHost = event.origin === 'host'
  const venueLabel = formatVenueDisplay(event.location, event.prefecture, event.area, event.title) || '場所要確認'
  const prefectureLabel = formatPrefectureDisplay(event.prefecture, event.area, event.location, event.title)
  const heroAreaLabel = prefectureLabel || venueLabel
  const dateLabel = event.eventDate ? formatDate(event.eventDate) : '日付未定'
  const sourceLabel = isHost ? '主催者募集' : getSourceLabel(event.sourceId) ?? 'AI収集'
  const heroBg = getEventHeroBackground(event.origin, event.sourceId)
  const deadline = deadlineBadge(event)

  return (
    <button type="button" className="event-card" onClick={onOpen}>
      <div className="event-card__visual" style={{ background: heroBg }}>
        <div className="event-card__badges">
          {event.isNew && <span className="event-card__badge event-card__badge--new">本日の新着</span>}
          {!isHost && (
            <span className="event-card__badge event-card__badge--ai">
              <Sparkles size={8} aria-hidden />
              AI収集
            </span>
          )}
          {deadline && (
            <span
              className={`event-card__badge ${deadline.urgent ? 'event-card__badge--urgent' : 'event-card__badge--deadline'}`}
            >
              {deadline.text}
            </span>
          )}
        </div>
        <div className="event-card__hero-content">
          <p className="event-card__hero-area">{heroAreaLabel}</p>
          <p className="event-card__hero-source">{sourceLabel}</p>
          {event.eventDate && <p className="event-card__hero-date">{dateLabel}</p>}
        </div>
      </div>
      <div className="event-card__body">
        <h3 className="event-card__title">{event.title}</h3>
        <p className="event-card__meta">
          {venueLabel}
          {prefectureLabel ? ` · ${prefectureLabel}` : ''} · {dateLabel}
        </p>
      </div>
    </button>
  )
}
