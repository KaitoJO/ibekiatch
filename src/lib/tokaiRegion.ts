/** 東海地方（三重・静岡・愛知・岐阜）— クライアント側フィルタ */

export const TOKAI_PREFECTURES = ['三重県', '静岡県', '愛知県', '岐阜県'] as const

const PREF_RE = [/三重県?/, /静岡県?/, /愛知県?/, /岐阜県?/]

const CITY_HINTS = [
  '四日市', '伊勢', '松阪', '桑名', '鈴鹿', '名張', '津市', '尾鷲', '熊野', '志摩', '鳥羽',
  '名古屋', '豊田', '岡崎', '一宮', '春日井', '豊橋', '刈谷', '安城', '西尾', '常滑', '半田',
  '静岡', '浜松', '沼津', '富士', '掛川', '藤枝', '焼津', '三島', '島田', '熱海', '伊東', '御殿場',
  '岐阜', '大垣', '多治見', '各務原', '中津川', '高山',
]

const OUTSIDE_RE =
  /東京|横浜|大阪|京都|神戸|福岡|仙台|札幌|湘南|茅ヶ崎|所沢|姫路|福島市|蒲田|千葉|埼玉/

const MIE_SOURCES = new Set([
  'mie_cities', 'mie_tourism', 'mie_news', 'mie_fm', 'ja_mie', 'maipure_mie',
  'shokokai', 'michinoeki', 'aeon_mall', 'outlet_mall',
])

export function isTokaiRegionText(...parts: (string | null | undefined)[]): boolean {
  const blob = parts.filter(Boolean).join('\n')
  if (!blob.trim()) return false
  const hasPref = PREF_RE.some((re) => re.test(blob))
  const hasCity = CITY_HINTS.some((c) => blob.includes(c))
  if (OUTSIDE_RE.test(blob) && !hasPref && !hasCity) return false
  if (/東海地方|東海エリア|中京/.test(blob)) return true
  return hasPref || hasCity
}

type TokaiEventLike = {
  title: string
  location: string
  area: string
  description?: string
  sourceId?: string | null
}

export function isTokaiDisplayEvent(event: TokaiEventLike): boolean {
  if (event.sourceId && MIE_SOURCES.has(event.sourceId)) return true
  return isTokaiRegionText(event.title, event.location, event.description ?? '')
}
