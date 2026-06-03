/** 東海地方（三重・静岡・愛知・岐阜）の判定・エリア推定 */

import {
  matchPrefectureFromText,
  normalizeLocationBlob,
  TOKAI_PREFECTURES,
} from './prefectureMap.mjs'

export { TOKAI_PREFECTURES }

export const MIE_LOCAL_SOURCE_IDS = new Set([
  'mie_cities',
  'mie_tourism',
  'ja_mie',
  'maipure_mie',
  'shokokai',
  'michinoeki',
  'aeon_mall',
  'outlet_mall',
])

export const TOKAI_PRIORITY_SOURCE_IDS = new Set([
  ...MIE_LOCAL_SOURCE_IDS,
  'jmty',
])

export const PUBLISH_CONFIDENCE_LOCAL = 75
export const PUBLISH_CONFIDENCE_TOKAI = 80
export const PUBLISH_CONFIDENCE_DEFAULT = 85

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

const OUTSIDE_TOKAI_RE =
  /東京|横浜|大阪|京都|神戸|福岡|仙台|札幌|広島|湘南|茅ヶ崎|所沢|姫路|福島市|蒲田|横須賀|千葉市|埼玉|栃木|群馬|茨城|新潟|長野|山梨|和歌山|奈良|滋賀|熊本|鹿児島|那覇|沖縄/

const TOKAI_BROAD_RE = /東海地方|東海エリア|東海3県|中京/

export function isTokaiRegionText(...parts) {
  const blob = normalizeLocationBlob(...parts)
  if (!blob.trim()) return false

  const matched = matchPrefectureFromText(blob)
  const matchedTokai = !!matched && TOKAI_PREFECTURES.includes(matched.prefecture)
  const hasOutside = OUTSIDE_TOKAI_RE.test(blob)

  // 東海以外の都道府県（大阪府・東京都など）にマッチしたら東海外と判定
  if (matched && !matchedTokai) return false
  if (hasOutside && !matchedTokai) return false
  if (TOKAI_BROAD_RE.test(blob)) return true
  return matchedTokai
}

export function resolveTokaiArea(title = '', location = '', snippet = '', sourceId = '') {
  if (MIE_LOCAL_SOURCE_IDS.has(sourceId)) {
    const fromText = matchPrefectureFromText(normalizeLocationBlob(title, location, snippet))
    return fromText ?? { area: '三重県', prefecture: '三重県' }
  }

  const blob = normalizeLocationBlob(title, location, snippet)
  if (!isTokaiRegionText(blob)) return null
  const matched = matchPrefectureFromText(blob)
  if (matched) {
    return {
      area: matched.cityLabel,
      prefecture: matched.prefecture,
    }
  }
  if (TOKAI_BROAD_RE.test(blob)) return { area: '東海地方', prefecture: '愛知県' }
  return null
}
