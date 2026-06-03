import { callAnthropicMessages, getAnthropicApiKey, stripInvalidSurrogates } from './urlUtils.mjs'
import { todayInJstDateKey } from './recruitmentStatus.mjs'

const DATE_MODEL = 'claude-haiku-4-5'

function normalizeDate(value) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const m = trimmed.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  return null
}

function inferYearForMonthDay(month, day) {
  const today = todayInJstDateKey()
  const [y] = today.split('-').map(Number)
  const candidate = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (candidate < today && month <= 3) return y + 1
  return y
}

function toDateKey(year, month, day) {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** ルールベース日付抽出（LLM前） */
export function extractDatesFromText(text) {
  const content = (text ?? '').replace(/\s+/g, ' ')
  const eventDates = []
  const recruitEnds = []

  for (const m of content.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)) {
    const key = toDateKey(+m[1], +m[2], +m[3])
    if (key) eventDates.push(key)
  }
  for (const m of content.matchAll(/(\d{1,2})月(\d{1,2})日/g)) {
    const key = toDateKey(inferYearForMonthDay(+m[1], +m[2]), +m[1], +m[2])
    if (key) eventDates.push(key)
  }
  for (const m of content.matchAll(/(\d{1,2})[\/／](\d{1,2})(?=\s|\(|（|日|,|、|~|〜|$|[^\d])/g)) {
    const key = toDateKey(inferYearForMonthDay(+m[1], +m[2]), +m[1], +m[2])
    if (key) eventDates.push(key)
  }

  for (const m of content.matchAll(
    /(?:締切|締め切り|エントリー締切|申込締切|応募締切)(?:日)?[:：\s]*(\d{1,2})[\/／](\d{1,2})/gi,
  )) {
    const key = toDateKey(inferYearForMonthDay(+m[1], +m[2]), +m[1], +m[2])
    if (key) recruitEnds.push(key)
  }
  for (const m of content.matchAll(
    /(?:締切|締め切り)(?:日)?[:：\s]*(\d{1,2})月(\d{1,2})日/gi,
  )) {
    const key = toDateKey(inferYearForMonthDay(+m[1], +m[2]), +m[1], +m[2])
    if (key) recruitEnds.push(key)
  }
  for (const m of content.matchAll(/(\d{1,2})[\/／](\d{1,2})が締切/g)) {
    const key = toDateKey(inferYearForMonthDay(+m[1], +m[2]), +m[1], +m[2])
    if (key) recruitEnds.push(key)
  }

  const range = content.match(
    /(?:募集期間|申込期間|エントリー期間)[:：\s]*(\d{1,2})[\/／月](\d{1,2})日?\s*[~〜\-－]\s*(\d{1,2})[\/／月](\d{1,2})日?/,
  )
  let recruitStart = null
  let recruitEnd = null
  if (range) {
    recruitStart = toDateKey(inferYearForMonthDay(+range[1], +range[2]), +range[1], +range[2])
    recruitEnd = toDateKey(inferYearForMonthDay(+range[3], +range[4]), +range[3], +range[4])
  }

  const uniqueEvents = [...new Set(eventDates)].sort()
  const uniqueEnds = [...new Set(recruitEnds)].sort()

  return {
    event_date: uniqueEvents.find((d) => d >= todayInJstDateKey()) ?? uniqueEvents.at(-1) ?? null,
    recruit_start: recruitStart,
    recruit_end: recruitEnd ?? uniqueEnds.find((d) => d >= todayInJstDateKey()) ?? uniqueEnds.at(-1) ?? null,
  }
}

function extractJson(text) {
  const raw = (text ?? '').trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

async function extractDatesWithLlm(title, content) {
  const apiKey = getAnthropicApiKey()
  if (!apiKey) return null

  const prompt = `以下の出店募集テキストから日付だけJSONで返してください。不明は空文字。
{
  "event_date": "YYYY-MM-DD",
  "recruit_start": "YYYY-MM-DD",
  "recruit_end": "YYYY-MM-DD"
}
タイトル: ${stripInvalidSurrogates(title).slice(0, 200)}
本文:
${stripInvalidSurrogates(content).slice(0, 1200)}`

  const res = await callAnthropicMessages(apiKey, {
    model: DATE_MODEL,
    max_tokens: 120,
    messages: [{ role: 'user', content: prompt }],
  })
  if (!res?.ok) return null

  const json = await res.json()
  const parsed = extractJson(json.content?.[0]?.text ?? '')
  if (!parsed) return null

  return {
    event_date: normalizeDate(parsed.event_date),
    recruit_start: normalizeDate(parsed.recruit_start),
    recruit_end: normalizeDate(parsed.recruit_end),
  }
}

/**
 * 構造化結果の欠損日付を regex → LLM の順で補完
 */
export async function supplementEventDates(structured, title, content) {
  const blob = `${title}\n${content}`
  const fromRules = extractDatesFromText(blob)

  let eventDate = structured.event_date || fromRules.event_date
  let recruitStart = structured.recruit_start || fromRules.recruit_start
  let recruitEnd = structured.recruit_end || fromRules.recruit_end

  const needsLlm = !eventDate || !recruitEnd
  if (needsLlm) {
    const fromLlm = await extractDatesWithLlm(title, content)
    if (fromLlm) {
      eventDate = eventDate || fromLlm.event_date
      recruitStart = recruitStart || fromLlm.recruit_start
      recruitEnd = recruitEnd || fromLlm.recruit_end
    }
  }

  return {
    ...structured,
    event_date: eventDate,
    recruit_start: recruitStart,
    recruit_end: recruitEnd,
  }
}

export { normalizeDate }
