import { useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  dateKey,
  formatDate,
  formatFee,
  getCalendarDays,
  parseYearMonth,
  toYearMonth,
} from '../../lib/recruitmentUtils'
import { ScreenHeader } from '../shared/ScreenHeader'
import '../shared/shared.css'
import './calendar.css'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function CalendarScreen() {
  const { calendarEvents } = useAuth()
  const [yearMonth, setYearMonth] = useState(() => toYearMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate())

  const days = useMemo(() => getCalendarDays(yearMonth), [yearMonth])
  const eventDates = useMemo(() => {
    const set = new Set<string>()
    for (const e of calendarEvents) set.add(e.date)
    return set
  }, [calendarEvents])

  const selectedDateKey =
    selectedDay != null ? dateKey(yearMonth, selectedDay) : null

  const dayEvents = useMemo(() => {
    if (!selectedDateKey) return []
    return calendarEvents.filter((e) => e.date === selectedDateKey)
  }, [calendarEvents, selectedDateKey])

  const shiftMonth = (delta: number) => {
    const d = parseYearMonth(yearMonth)
    d.setMonth(d.getMonth() + delta)
    setYearMonth(toYearMonth(d))
    setSelectedDay(null)
  }

  const [y, m] = yearMonth.split('-').map(Number)
  const today = new Date()
  const isTodayMonth = today.getFullYear() === y && today.getMonth() + 1 === m

  return (
    <div className="calendar-screen screen">
      <ScreenHeader title="カレンダー" gradient />

      <div className="calendar-nav">
        <button type="button" className="calendar-nav__btn" onClick={() => shiftMonth(-1)} aria-label="前月">
          ‹
        </button>
        <span className="calendar-nav__label">
          {y}年{m}月
        </span>
        <button type="button" className="calendar-nav__btn" onClick={() => shiftMonth(1)} aria-label="翌月">
          ›
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`calendar-grid__head${i === 0 ? ' calendar-grid__head--sun' : ''}${i === 6 ? ' calendar-grid__head--sat' : ''}`}
          >
            {w}
          </div>
        ))}
        {days.map((day, idx) => {
          if (day == null) {
            return <div key={`empty-${idx}`} className="calendar-day calendar-day--empty" />
          }
          const key = dateKey(yearMonth, day)
          const hasEvent = eventDates.has(key)
          const isToday = isTodayMonth && day === today.getDate()
          const isSelected = selectedDay === day
          return (
            <button
              key={key}
              type="button"
              className={`calendar-day${hasEvent ? ' calendar-day--has-event' : ''}${isToday ? ' calendar-day--today' : ''}${isSelected ? ' calendar-day--selected' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              {day}
              {hasEvent && <span className="calendar-day__dot" />}
            </button>
          )
        })}
      </div>

      <section className="calendar-events">
        <h2 className="calendar-events__title">
          {selectedDay != null ? `${m}/${selectedDay} の出店予定` : '日付を選択'}
        </h2>

        {dayEvents.length === 0 ? (
          <div className="empty-block">
            <div className="empty-block__icon">📅</div>
            <p className="empty-block__title">予定がありません</p>
            <p>ホームから募集に応募すると、出店日がここに表示されます。</p>
          </div>
        ) : (
          dayEvents.map((event) => (
            <article key={event.id} className="calendar-event-card">
              <h3 className="calendar-event-card__title">{event.title}</h3>
              <p className="calendar-event-card__meta">
                {event.venue}
                <br />
                {event.area} · {event.timeSlot}
                <br />
                出店日: {formatDate(event.date)}
              </p>
              <div className="calendar-event-card__footer">
                <span className={`status-badge status-badge--${event.status}`}>
                  {event.status === 'pending' ? '審査中' : event.status === 'accepted' ? '承認' : '不採用'}
                </span>
                <span className="calendar-event-card__fee">{formatFee(event.fee, true)}</span>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
