import type { CollectedEvent, DisplayEvent, Recruitment } from '../types'
import { formatFee } from './recruitmentUtils'
import { todayInJstDateKey } from './recruitmentStatus'

const TOKAI_FILTER_KEYWORDS = [
  '愛知', '岐阜', '三重', '静岡', '名古屋', '伊勢', '津', '四日市', '松阪', '鈴鹿',
] as const

/** 終了済み（出店日が今日より前）を除外 */
export function isExpiredEventDate(eventDate: string | null): boolean {
  if (!eventDate) return false
  return eventDate < todayInJstDateKey()
}

/** 東海地方キーワード（タイトル・会場・エリア） */
export function isTokaiKeywordEvent(event: {
  title: string
  location: string
  area: string
}): boolean {
  const text = `${event.title} ${event.location} ${event.area}`
  return TOKAI_FILTER_KEYWORDS.some((kw) => text.includes(kw))
}

function passesEventListFilter(
  event: {
    title: string
    location: string
    area: string
    eventDate: string | null
  },
  tokaiOnly: boolean,
): boolean {
  if (isExpiredEventDate(event.eventDate)) return false
  if (!tokaiOnly) return true
  return isTokaiKeywordEvent(event)
}

function isTodayInJst(iso: string): boolean {
  const d = new Date(iso)
  const jst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  return (
    jst.getFullYear() === now.getFullYear() &&
    jst.getMonth() === now.getMonth() &&
    jst.getDate() === now.getDate()
  )
}

export function recruitmentToDisplayEvent(r: Recruitment): DisplayEvent {
  return {
    id: `host-${r.id}`,
    title: r.title,
    organizer: '',
    location: r.venue,
    area: r.area,
    eventDate: r.date,
    recruitEnd: null,
    feeLabel: formatFee(r.fee),
    category: r.genre,
    applicationUrl: null,
    sourceUrl: r.sourceUrl,
    sourceId: null,
    origin: 'host',
    recruitmentId: r.id,
    description: r.description,
    isNew: r.isNew,
    isUrgent: r.isUrgent,
    imageGradient: r.imageGradient,
    applicants: r.applicants,
    maxApplicants: r.maxApplicants,
    timeSlot: r.timeSlot,
    status: 'open',
  }
}

export function collectedEventToDisplayEvent(e: CollectedEvent): DisplayEvent {
  return {
    id: e.id,
    title: e.title,
    organizer: e.organizer,
    location: e.location,
    area: e.area,
    eventDate: e.eventDate,
    recruitEnd: e.recruitEnd,
    feeLabel: e.fee || '要確認',
    category: e.category,
    applicationUrl: e.applicationUrl,
    sourceUrl: e.sourceUrl,
    sourceId: e.sourceId,
    origin: 'collected',
    recruitmentId: null,
    description: e.description,
    isNew: isTodayInJst(e.createdAt),
    isUrgent: false,
    imageGradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    applicants: 0,
    maxApplicants: 0,
    timeSlot: '',
    status: e.status,
  }
}

export function mergeEventList(
  collected: CollectedEvent[],
  recruitments: Recruitment[],
  options: { includeClosed?: boolean; tokaiOnly?: boolean } = {},
): DisplayEvent[] {
  const { includeClosed = false, tokaiOnly = true } = options
  const host = recruitments
    .map(recruitmentToDisplayEvent)
    .filter((e) =>
      passesEventListFilter(
        { title: e.title, location: e.location, area: e.area, eventDate: e.eventDate },
        tokaiOnly,
      ),
    )
  const ai = collected
    .filter((e) => includeClosed || e.status === 'open')
    .filter((e) =>
      passesEventListFilter(
        { title: e.title, location: e.location, area: e.area, eventDate: e.eventDate },
        tokaiOnly,
      ),
    )
    .map(collectedEventToDisplayEvent)

  return [...host, ...ai].sort((a, b) => {
    const da = a.eventDate ?? '9999-12-31'
    const db = b.eventDate ?? '9999-12-31'
    if (da !== db) return da.localeCompare(db)
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1
    return a.title.localeCompare(b.title, 'ja')
  })
}

export function filterDisplayEvents(
  events: DisplayEvent[],
  filters: { area?: string; search?: string },
): DisplayEvent[] {
  const area = filters.area ?? 'すべて'
  const q = (filters.search ?? '').trim().toLowerCase()
  return events.filter((e) => {
    if (area !== 'すべて' && e.area !== area) return false
    if (!q) return true
    const blob = `${e.title} ${e.location} ${e.area} ${e.category} ${e.organizer}`.toLowerCase()
    return blob.includes(q)
  })
}

export function deriveEventAreas(events: DisplayEvent[]): string[] {
  const set = new Set(events.map((e) => e.area).filter(Boolean))
  return ['すべて', ...[...set].sort((a, b) => a.localeCompare(b, 'ja'))]
}
