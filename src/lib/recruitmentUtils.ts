import { AREAS, GENRES } from '../data/mockRecruitments'
import type { Recruitment, RecruitmentFilters } from '../types'

export { AREAS, GENRES }

export function filterRecruitments(
  recruitments: Recruitment[],
  filters: RecruitmentFilters,
): Recruitment[] {
  const search = filters.search.trim().toLowerCase()
  return recruitments.filter((r) => {
    const areaMatch = filters.area === 'すべて' || r.area === filters.area
    const genreMatch = filters.genre === 'すべて' || r.genre === filters.genre
    const searchMatch =
      !search ||
      r.title.toLowerCase().includes(search) ||
      r.venue.toLowerCase().includes(search) ||
      r.area.toLowerCase().includes(search) ||
      r.genre.toLowerCase().includes(search)
    return areaMatch && genreMatch && searchMatch
  })
}

export function deriveFilterOptions(recruitments: Recruitment[]) {
  const areas = new Set<string>(['すべて'])
  const genres = new Set<string>(['すべて'])
  for (const r of recruitments) {
    areas.add(r.area)
    genres.add(r.genre)
  }
  AREAS.forEach((a) => areas.add(a))
  GENRES.forEach((g) => genres.add(g))
  return {
    areas: [...areas],
    genres: [...genres],
  }
}

export function formatFee(fee: number, compact = false) {
  if (compact) return `¥${(fee / 1000).toFixed(0)}k`
  return `¥${fee.toLocaleString('ja-JP')}`
}

export function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${month}/${day}（${weekdays[d.getDay()]}）`
}

export function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function toYearMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function parseYearMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export function getCalendarDays(yearMonth: string) {
  const first = parseYearMonth(yearMonth)
  const year = first.getFullYear()
  const month = first.getMonth()
  const startDay = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(startDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function dateKey(yearMonth: string, day: number) {
  return `${yearMonth}-${String(day).padStart(2, '0')}`
}
