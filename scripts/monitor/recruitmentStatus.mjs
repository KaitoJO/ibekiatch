/** 募集終了・受付終了などを示すパターン（タイトル・本文） */
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

/** 出店者募集ではなく、出店報告・チケット譲渡など */
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
  // 出店者の「紹介」投稿（募集ではない）
  /出店者(?:様)?(?:の)?ご?紹介/,
  /出店(?:者|店舗|車両)(?:様)?(?:を)?ご紹介/,
  /出店者紹介/,
  /本日の出店(?:者|車両|店舗)/,
]

/** まとめ・募集情報アグリゲーター（複数イベントの寄せ集め＝単一イベントではない） */
const AGGREGATOR_PATTERNS = [
  /各主催者様(?:へ|まで)/,
  /出店(?:者)?募集情報/,
  /募集情報[】\]]/,
  /(?:（|【)?まとめ(?:）|】)?版/,
  /(?:今週|来週|今月|来月).{0,6}(?:募集情報|出店情報)/,
  /出店募集(?:まとめ|一覧)/,
]

/** 出店者募集ではなく、運営側のスタッフ・アルバイト募集や自己宣伝 */
const STAFF_RECRUITMENT_PATTERNS = [
  /(?:アルバイト|バイト|スタッフ|パート|従業員|社員|キッチンスタッフ|ホールスタッフ)[^。\n]{0,12}(?:募集|急募|大募集)/,
  /(?:アルバイト|バイト)(?:さん|ちゃん)/,
]

/** 開催レポート・アーカイブ・過去開催記録（募集ではない） */
const REPORT_ARCHIVE_PATTERNS = [
  /開催レポート/,
  /開催報告/,
  /開催記録/,
  /イベントレポート/,
  /レポート公開/,
  /昨年の様子/,
  /去年の様子/,
  /過去の様子/,
  /過去開催/,
  /無事終了/,
  /盛況のうちに/,
  /アーカイブ/,
  /開催されました/,
  /(?:ご)?来場(?:いただき)?ありがとう/,
]

const RECRUITMENT_CONTEXT_RE = /募集|募集中|出店者|エントリー|締切|申込|応募|出店者募/

export function todayInJstDateKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())
}

function getTodayParts() {
  const todayKey = todayInJstDateKey()
  const [year, month, day] = todayKey.split('-').map(Number)
  return { todayKey, year, month, day }
}

function toDateKey(year, month, day) {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function inferYearForMonthDay(month, day, referenceYear) {
  return referenceYear
}

function extractAllDateKeys(text) {
  const { year: currentYear } = getTodayParts()
  const keys = new Set()

  for (const m of text.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)) {
    const key = toDateKey(+m[1], +m[2], +m[3])
    if (key) keys.add(key)
  }

  for (const m of text.matchAll(/(\d{4})[\/／](\d{1,2})[\/／](\d{1,2})/g)) {
    const key = toDateKey(+m[1], +m[2], +m[3])
    if (key) keys.add(key)
  }

  for (const m of text.matchAll(/(\d{1,2})月(\d{1,2})日/g)) {
    const key = toDateKey(inferYearForMonthDay(+m[1], +m[2], currentYear), +m[1], +m[2])
    if (key) keys.add(key)
  }

  for (const m of text.matchAll(/(\d{1,2})[\/／](\d{1,2})(?=\s|\(|（|日|,|、|・|~|〜|$|[^\d])/g)) {
    const key = toDateKey(inferYearForMonthDay(+m[1], +m[2], currentYear), +m[1], +m[2])
    if (key) keys.add(key)
  }

  return [...keys]
}

function extractDeadlineDateKeys(text) {
  const { year: currentYear } = getTodayParts()
  const keys = new Set()

  const add = (month, day, year = currentYear) => {
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

function hasPastDeadline(text) {
  const { todayKey } = getTodayParts()
  const deadlines = extractDeadlineDateKeys(text)
  if (deadlines.length === 0) return false
  return deadlines.every((key) => key < todayKey)
}

function hasOnlyPastEventDates(text) {
  const { todayKey } = getTodayParts()
  const dates = extractAllDateKeys(text)
  if (dates.length === 0) return false
  if (!RECRUITMENT_CONTEXT_RE.test(text)) return false
  return dates.every((key) => key < todayKey)
}

function isNotRecruitmentPost(text) {
  return NOT_RECRUITMENT_PATTERNS.some((re) => re.test(text))
}

/** 開催レポート・アーカイブなど（募集ではない過去記録） */
export function isReportOrArchive(text = '') {
  return REPORT_ARCHIVE_PATTERNS.some((re) => re.test(text))
}

/** まとめ・募集情報アグリゲーター投稿（単一イベントではない） */
export function isAggregatorPost(text = '') {
  return AGGREGATOR_PATTERNS.some((re) => re.test(text))
}

/** スタッフ・アルバイト募集（出店者募集ではない） */
export function isStaffRecruitment(text = '') {
  return STAFF_RECRUITMENT_PATTERNS.some((re) => re.test(text))
}

export function isClosedRecruitmentText(title, snippet = '') {
  const text = `${title ?? ''}\n${snippet ?? ''}`.replace(/\s+/g, ' ')
  if (!text.trim()) return false

  if (CLOSED_RECRUITMENT_PATTERNS.some((re) => re.test(text))) return true
  if (isNotRecruitmentPost(text)) return true
  if (isReportOrArchive(text)) return true
  if (isAggregatorPost(text)) return true
  if (isStaffRecruitment(text)) return true
  if (hasPastDeadline(text)) return true
  if (hasOnlyPastEventDates(text)) return true

  return false
}

export function isPastEventDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  return dateStr < todayInJstDateKey()
}

export function isActiveMonitorHit(row) {
  return !isClosedRecruitmentText(row.title, row.snippet)
}
