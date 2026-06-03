import type { MonitorHit, Recruitment } from '../types'

const CLOSED_RECRUITMENT_PATTERNS = [
  /募集(?:は|が|を)?終了/,
  /受付(?:は|が|を)?終了/,
  /申込(?:み)?(?:は|が|を)?終了/,
  /申し込み(?:は|が|を)?終了/,
  /エントリー(?:は|が|を)?終了/,
  /締(?:め)?切(?:り)?済/,
  /締切(?:は|が|を)?終了/,
  /定員(?:に)?(?:達し|満了|に達)/,
  /満員(?:御礼|とな|に達)/,
  /開催(?:を)?中止/,
  /イベント(?:は|が)?中止/,
  /本募集は終了/,
  /本イベントは終了/,
  /出店者(?:様)?確定/,
  /(?:は|が)終了しました/,
  /(?:は|が)終了いたしました/,
  /キャンセル(?:とな|に)/,
]

const NOT_RECRUITMENT_PATTERNS = [
  /出店のお知らせ/,
  /本日出店/,
  /出店しました/,
  /出店します(?!.*募集)/,
  /出店中(?!.*募集)/,
  /買い取ってくださる/,
  /お譲り(?:します|可能|します)/,
  /譲ります/,
  /リプ(?:ライ)?(?:ください|お願い)/,
]

const RECRUITMENT_CONTEXT_RE = /募集|募集中|出店者|エントリー|締切|申込|応募|出店者募/

export function todayInJstDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())
}

function getTodayParts() {
  const todayKey = todayInJstDateKey()
  const [year, month, day] = todayKey.split('-').map(Number)
  return { todayKey, year, month, day }
}

function toDateKey(year: number, month: number, day: number): string | null {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function extractAllDateKeys(text: string): string[] {
  const { year: currentYear } = getTodayParts()
  const keys = new Set<string>()

  for (const m of text.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)) {
    const key = toDateKey(+m[1], +m[2], +m[3])
    if (key) keys.add(key)
  }

  for (const m of text.matchAll(/(\d{4})[\/／](\d{1,2})[\/／](\d{1,2})/g)) {
    const key = toDateKey(+m[1], +m[2], +m[3])
    if (key) keys.add(key)
  }

  for (const m of text.matchAll(/(\d{1,2})月(\d{1,2})日/g)) {
    const key = toDateKey(currentYear, +m[1], +m[2])
    if (key) keys.add(key)
  }

  for (const m of text.matchAll(/(\d{1,2})[\/／](\d{1,2})(?=\s|\(|（|日|,|、|・|~|〜|$|[^\d])/g)) {
    const key = toDateKey(currentYear, +m[1], +m[2])
    if (key) keys.add(key)
  }

  return [...keys]
}

function extractDeadlineDateKeys(text: string): string[] {
  const { year: currentYear } = getTodayParts()
  const keys = new Set<string>()

  const add = (month: number, day: number, year = currentYear) => {
    const key = toDateKey(year, month, day)
    if (key) keys.add(key)
  }

  for (const m of text.matchAll(
    /(?:締切|締め切り|エントリー締切|申込締切|応募締切)(?:日)?[:：\s]*(?:本日)?(\d{1,2})[\/／](\d{1,2})/gi,
  )) {
    add(+m[1], +m[2])
  }

  for (const m of text.matchAll(
    /(?:締切|締め切り|エントリー締切|申込締切|応募締切)(?:日)?[:：\s]*(\d{1,2})月(\d{1,2})日/g,
  )) {
    add(+m[1], +m[2])
  }

  for (const m of text.matchAll(/(\d{1,2})[\/／](\d{1,2})が締切/g)) {
    add(+m[1], +m[2])
  }

  for (const m of text.matchAll(/本日(\d{1,2})[\/／](\d{1,2})が締切/g)) {
    add(+m[1], +m[2])
  }

  for (const m of text.matchAll(/(\d{1,2})月(\d{1,2})日(?:\(.\)|（.\)|まで)?[が]?締切/g)) {
    add(+m[1], +m[2])
  }

  return [...keys]
}

function hasPastDeadline(text: string): boolean {
  const { todayKey } = getTodayParts()
  const deadlines = extractDeadlineDateKeys(text)
  if (deadlines.length === 0) return false
  return deadlines.every((key) => key < todayKey)
}

function hasOnlyPastEventDates(text: string): boolean {
  const { todayKey } = getTodayParts()
  const dates = extractAllDateKeys(text)
  if (dates.length === 0) return false
  if (!RECRUITMENT_CONTEXT_RE.test(text)) return false
  return dates.every((key) => key < todayKey)
}

function isNotRecruitmentPost(text: string): boolean {
  return NOT_RECRUITMENT_PATTERNS.some((re) => re.test(text))
}

export function isClosedRecruitmentText(title: string, snippet = ''): boolean {
  const text = `${title}\n${snippet}`.replace(/\s+/g, ' ')
  if (!text.trim()) return false

  if (CLOSED_RECRUITMENT_PATTERNS.some((re) => re.test(text))) return true
  if (isNotRecruitmentPost(text)) return true
  if (hasPastDeadline(text)) return true
  if (hasOnlyPastEventDates(text)) return true

  return false
}

export function isPastEventDate(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  return dateStr < todayInJstDateKey()
}

export function filterActiveMonitorHits(hits: MonitorHit[]): MonitorHit[] {
  return hits.filter((h) => !isClosedRecruitmentText(h.title, h.snippet))
}

export function filterActiveRecruitments(recruitments: Recruitment[]): Recruitment[] {
  return recruitments.filter((r) => !isPastEventDate(r.date))
}
