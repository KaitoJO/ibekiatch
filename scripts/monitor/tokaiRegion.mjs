/** 東海地方（三重・静岡・愛知・岐阜）の判定・エリア推定 */

export const TOKAI_PREFECTURES = ['三重県', '静岡県', '愛知県', '岐阜県']

export const MIE_LOCAL_SOURCE_IDS = new Set([
  'mie_cities',
  'mie_tourism',
  'mie_news',
  'mie_fm',
  'ja_mie',
  'maipure_mie',
  'shokokai',
  'michinoeki',
  'aeon_mall',
  'outlet_mall',
])

/** 東海ローカル扱い — confidence 閾値を下げる */
export const TOKAI_PRIORITY_SOURCE_IDS = new Set([
  ...MIE_LOCAL_SOURCE_IDS,
  'jmty',
])

export const PUBLISH_CONFIDENCE_LOCAL = 65
export const PUBLISH_CONFIDENCE_TOKAI = 70
export const PUBLISH_CONFIDENCE_DEFAULT = 80

/**
 * @param {string} sourceId
 * @param {{ hitTitle?: string, hitSnippet?: string }} [ctx] — 未処理 hit の本文。東海地名があれば全国ソースも 70 に緩和
 */
export function getPublishConfidenceMin(sourceId = '', ctx = {}) {
  if (MIE_LOCAL_SOURCE_IDS.has(sourceId)) return PUBLISH_CONFIDENCE_LOCAL
  if (TOKAI_PRIORITY_SOURCE_IDS.has(sourceId)) return PUBLISH_CONFIDENCE_TOKAI
  const { hitTitle = '', hitSnippet = '' } = ctx
  if (isTokaiRegionText(hitTitle, hitSnippet)) return PUBLISH_CONFIDENCE_TOKAI
  return PUBLISH_CONFIDENCE_DEFAULT
}

export function isTokaiPrioritySource(sourceId = '') {
  return TOKAI_PRIORITY_SOURCE_IDS.has(sourceId)
}

/**
 * 未処理キュー並び替え用スコア（大きいほど先）
 * @param {number} [keywordScore] — scoreRecruitmentText の結果（三重ローカルのノイズ抑制用）
 */
export function hitProcessingPriority(hit, keywordScore = 0) {
  let score = 0
  if (MIE_LOCAL_SOURCE_IDS.has(hit.source_id)) {
    if (keywordScore >= 40) score += 100
    else if (keywordScore >= 25) score += 70
    else if (keywordScore >= 15) score += 40
    else score += 5
  } else if (TOKAI_PRIORITY_SOURCE_IDS.has(hit.source_id)) score += 80
  if (isTokaiRegionText(hit.title, hit.snippet)) score += 40
  score += Math.min(35, Math.floor(keywordScore / 2))
  return score
}

const PREFecture_RES = [
  { pref: '三重県', re: /三重県?/ },
  { pref: '静岡県', re: /静岡県?/ },
  { pref: '愛知県', re: /愛知県?/ },
  { pref: '岐阜県', re: /岐阜県?/ },
]

const CITY_HINTS = [
  ['四日市', '四日市市', '三重県'],
  ['伊勢', '伊勢市', '三重県'],
  ['松阪', '松阪市', '三重県'],
  ['桑名', '桑名市', '三重県'],
  ['鈴鹿', '鈴鹿市', '三重県'],
  ['名張', '名張市', '三重県'],
  ['津市', '津市', '三重県'],
  ['尾鷲', '尾鷲市', '三重県'],
  ['熊野', '熊野市', '三重県'],
  ['志摩', '志摩市', '三重県'],
  ['鳥羽', '鳥羽市', '三重県'],
  ['名古屋', '名古屋市', '愛知県'],
  ['豊田', '豊田市', '愛知県'],
  ['岡崎', '岡崎市', '愛知県'],
  ['一宮', '一宮市', '愛知県'],
  ['春日井', '春日井市', '愛知県'],
  ['豊橋', '豊橋市', '愛知県'],
  ['刈谷', '刈谷市', '愛知県'],
  ['安城', '安城市', '愛知県'],
  ['西尾', '西尾市', '愛知県'],
  ['常滑', '常滑市', '愛知県'],
  ['半田', '半田市', '愛知県'],
  ['静岡', '静岡市', '静岡県'],
  ['浜松', '浜松市', '静岡県'],
  ['沼津', '沼津市', '静岡県'],
  ['富士', '富士市', '静岡県'],
  ['掛川', '掛川市', '静岡県'],
  ['藤枝', '藤枝市', '静岡県'],
  ['焼津', '焼津市', '静岡県'],
  ['三島', '三島市', '静岡県'],
  ['島田', '島田市', '静岡県'],
  ['熱海', '熱海市', '静岡県'],
  ['伊東', '伊東市', '静岡県'],
  ['御殿場', '御殿場市', '静岡県'],
  ['岐阜', '岐阜市', '岐阜県'],
  ['大垣', '大垣市', '岐阜県'],
  ['多治見', '多治見市', '岐阜県'],
  ['各務原', '各務原市', '岐阜県'],
  ['中津川', '中津川市', '岐阜県'],
  ['高山', '高山市', '岐阜県'],
]

const OUTSIDE_TOKAI_RE =
  /東京|横浜|大阪|京都|神戸|福岡|仙台|札幌|広島|湘南|茅ヶ崎|所沢|姫路|福島市|蒲田|横須賀|千葉市|埼玉|栃木|群馬|茨城|新潟|長野|山梨|和歌山|奈良|滋賀|熊本|鹿児島|那覇|沖縄/

const TOKAI_BROAD_RE = /東海地方|東海エリア|東海3県|中京/

function normalizeBlob(...parts) {
  return parts
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, ' ')
}

export function isTokaiRegionText(...parts) {
  const blob = normalizeBlob(...parts)
  if (!blob.trim()) return false

  const hasTokaiPref = PREFecture_RES.some(({ re }) => re.test(blob))
  const hasTokaiCity = CITY_HINTS.some(([hint]) => {
    if (!blob.includes(hint)) return false
    if (hint === '岡崎' && /京都/.test(blob) && !/愛知|岡崎市/.test(blob)) return false
    return true
  })
  const hasOutside = OUTSIDE_TOKAI_RE.test(blob)

  if (hasOutside && !hasTokaiPref && !hasTokaiCity) return false
  if (TOKAI_BROAD_RE.test(blob)) return true
  if (hasTokaiPref || hasTokaiCity) return true
  return false
}

export function resolveTokaiArea(title = '', location = '', snippet = '', sourceId = '') {
  if (MIE_LOCAL_SOURCE_IDS.has(sourceId)) {
    const fromText = matchCityOrPref(normalizeBlob(title, location, snippet))
    return fromText ?? { area: '三重県', prefecture: '三重県' }
  }

  const blob = normalizeBlob(title, location, snippet)
  if (!isTokaiRegionText(blob)) return null
  return matchCityOrPref(blob)
}

function matchCityOrPref(blob) {
  for (const [hint, label, pref] of CITY_HINTS) {
    if (!blob.includes(hint)) continue
    // 京都岡崎など — 愛知の岡崎市と区別
    if (hint === '岡崎' && /京都/.test(blob) && !/愛知|岡崎市/.test(blob)) continue
    return { area: label, prefecture: pref }
  }
  for (const { pref, re } of PREFecture_RES) {
    if (re.test(blob)) return { area: pref, prefecture: pref }
  }
  if (TOKAI_BROAD_RE.test(blob)) return { area: '東海地方', prefecture: '愛知県' }
  return null
}
