/** 低品質・非募集コンテンツの confidence 降格（ユーザー操作なし） */

const HARD_REJECT_CATEGORIES = new Set(['無関係', '募集終了'])

const LOW_QUALITY_PATTERNS = [
  { re: /出演者募集|歌手募集|ダンサー募集|ボランティア募集|スタッフ募集|アルバイト募集|求人募集/, penalty: 100 },
  { re: /ミュージアムショップ|委託販売|棚貸し|テナント募集|店舗出店|常設ショップ|物販コーナー/, penalty: 100 },
  { re: /出店のお知らせ|本日出店|出店しました|出店します(?!.*募集)/, penalty: 80 },
  { re: /お譲り|譲ります|買い取って|リプ(?:ライ)?(?:ください|お願い)/, penalty: 90 },
  { re: /チケット|入場券|整理券/, penalty: 40 },
  { re: /感想|レポート|行ってきました|食べました/, penalty: 70 },
]

const WEAK_RECRUITMENT_RE = /募集|募集中|出店者|エントリー|申込|応募/

/**
 * structured.confidence と is_recruiting を裏側で調整
 */
export function applyQualityAdjustments(structured, title = '', snippet = '') {
  const text = `${title}\n${snippet}\n${structured.title ?? ''}`
  let confidence = structured.confidence
  let isRecruiting = structured.is_recruiting
  const category = structured.category

  for (const { re, penalty } of LOW_QUALITY_PATTERNS) {
    if (re.test(text)) {
      confidence = Math.max(0, confidence - penalty)
      if (penalty >= 80) isRecruiting = false
    }
  }

  if (HARD_REJECT_CATEGORIES.has(category)) {
    confidence = Math.min(confidence, 30)
    isRecruiting = false
  }

  if (isRecruiting && !WEAK_RECRUITMENT_RE.test(text) && confidence > 0) {
    confidence = Math.max(0, confidence - 25)
  }

  return {
    ...structured,
    is_recruiting: isRecruiting,
    confidence: Math.min(100, Math.max(0, Math.round(confidence))),
  }
}

export function shouldSkipBeforeAi(title, snippet) {
  const text = `${title}\n${snippet}`
  return LOW_QUALITY_PATTERNS.some(({ re, penalty }) => penalty >= 90 && re.test(text))
}
