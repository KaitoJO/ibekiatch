/** 仕様どおりのキーワードスコアリング（収集→AI前のふるい） */

const POSITIVE = [
  { phrase: '出店募集', score: 40 },
  { phrase: 'キッチンカー募集', score: 40 },
  { phrase: '出店者募集', score: 40 },
  { phrase: 'マルシェ出店', score: 30 },
  { phrase: '飲食出店', score: 30 },
  { phrase: '露店募集', score: 30 },
  { phrase: 'フードトラック募集', score: 30 },
  { phrase: '移動販売', score: 25 },
  { phrase: '事業者募集', score: 30 },
  { phrase: '募集が開始', score: 25 },
  { phrase: 'キッチンカー', score: 20 },
  { phrase: 'マルシェ', score: 20 },
  { phrase: 'イベント出店', score: 20 },
  { phrase: '応募フォーム', score: 20 },
  { phrase: '募集期間', score: 15 },
  { phrase: '出店料', score: 15 },
]

const NEGATIVE = [
  { phrase: '募集終了', score: -100 },
  { phrase: '締切', score: -100 },
  { phrase: '受付終了', score: -100 },
  { phrase: '受付を終了', score: -100 },
  { phrase: '応募終了', score: -100 },
  { phrase: '満枠', score: -100 },
  { phrase: '定員到達', score: -100 },
  { phrase: '終了しました', score: -100 },
  { phrase: 'キャンセル待ち', score: -50 },
]

const EXCLUSION = [
  '出演者募集',
  '歌手募集',
  'ダンサー募集',
  'ボランティア募集',
  'スタッフ募集',
  'アルバイト募集',
  '求人募集',
  'ミュージアムショップ',
  '委託販売',
  '棚貸し',
  'テナント募集',
  '店舗出店',
]

export function scoreRecruitmentText(title, snippet = '') {
  const text = `${title ?? ''}\n${snippet ?? ''}`
  let score = 0

  for (const { phrase, score: pts } of POSITIVE) {
    if (text.includes(phrase)) score += pts
  }
  for (const { phrase, score: pts } of NEGATIVE) {
    if (text.includes(phrase)) score += pts
  }
  for (const phrase of EXCLUSION) {
    if (text.includes(phrase)) score -= 100
  }

  return score
}

/** デフォルト25点以上でAIへ（キーワード一致済みの候補をさらに絞る） */
export function passesKeywordScore(title, snippet, minScore = 25) {
  return scoreRecruitmentText(title, snippet) >= minScore
}
