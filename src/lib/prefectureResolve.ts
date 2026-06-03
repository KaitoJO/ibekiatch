import tokaiCities from '../../data/tokai-cities.json'
import extraCities from '../../data/japan-cities-extra.json'

export const TOKAI_PREFECTURES = ['三重県', '静岡県', '愛知県', '岐阜県'] as const

type CityEntry = {
  hints: string[]
  cityLabel: string
  prefecture: string
  exclude?: string[]
}

const PREF_RE = [
  /三重県?/,
  /静岡県?/,
  /愛知県?/,
  /岐阜県?/,
  /大阪[府県]?/,
  /京都[府県]?/,
  /兵庫県?/,
  /神奈川県?/,
  /東京都?/,
  /(?:北海道|.{2,3}県)/,
]

const ALL_CITIES = [...(tokaiCities as CityEntry[]), ...(extraCities as CityEntry[])]

const SORTED_CITIES = [...ALL_CITIES].sort(
  (a, b) => Math.max(...b.hints.map((h) => h.length)) - Math.max(...a.hints.map((h) => h.length)),
)

const OUTSIDE_RE =
  /東京|横浜|大阪|京都|神戸|福岡|仙台|札幌|湘南|茅ヶ崎|所沢|姫路|福島市|蒲田|千葉|埼玉/

function normalizeBlob(...parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join('\n').replace(/\s+/g, ' ')
}

function matchesCityEntry(blob: string, entry: CityEntry) {
  if (!entry.hints.some((hint) => blob.includes(hint))) return false
  if (entry.exclude?.some((ex) => blob.includes(ex))) return false
  if (entry.cityLabel === '岡崎市' && /京都/.test(blob) && !/愛知|岡崎市/.test(blob)) return false
  return true
}

export function matchCityFromText(blob: string): { cityLabel: string; prefecture: string } | null {
  for (const entry of SORTED_CITIES) {
    if (matchesCityEntry(blob, entry)) {
      return { cityLabel: entry.cityLabel, prefecture: entry.prefecture }
    }
  }
  return null
}

export function resolvePrefectureFromText(...parts: (string | null | undefined)[]): string {
  const blob = normalizeBlob(...parts)
  const city = matchCityFromText(blob)
  if (city) return city.prefecture
  for (const re of PREF_RE) {
    const m = blob.match(re)
    if (!m) continue
    const raw = m[0]
    if (raw === '大阪' || raw === '京都') return `${raw}府`
    if (raw.endsWith('都') || raw.endsWith('府') || raw.endsWith('県')) return raw
    if (raw === '東京') return '東京都'
    return `${raw}県`
  }
  return ''
}

export function isTokaiRegionText(...parts: (string | null | undefined)[]): boolean {
  const blob = normalizeBlob(...parts)
  if (!blob.trim()) return false
  const hasPref = TOKAI_PREFECTURES.some((p) => blob.includes(p.replace('県', '')))
  const hasCity = SORTED_CITIES.some(
    (entry) => TOKAI_PREFECTURES.includes(entry.prefecture as (typeof TOKAI_PREFECTURES)[number]) && matchesCityEntry(blob, entry),
  )
  if (OUTSIDE_RE.test(blob) && !hasPref && !hasCity) return false
  if (/東海地方|東海エリア|中京/.test(blob)) return true
  return hasPref || hasCity
}

/** venue（会場）と prefecture（都道府県）を分離 */
export function resolveVenueAndPrefectureFields(
  location: string,
  prefecture: string,
  areaFallback = '',
  title = '',
) {
  const resolvedPref = resolvePrefectureFromText(location, title, prefecture, areaFallback)
  const storedPref = prefecture.trim() || (areaFallback.endsWith('県') || areaFallback.endsWith('府') ? areaFallback : '')
  const finalPref = resolvedPref || storedPref

  let venue = location.trim()
  const city = matchCityFromText(normalizeBlob(location, title))

  if (venue === finalPref || /^.+[都府県]$/.test(venue) && venue === finalPref) {
    venue = city?.cityLabel ?? ''
  }
  if (!venue && city) venue = city.cityLabel

  return { venue, prefecture: finalPref }
}

export function formatVenueDisplay(
  location: string,
  prefecture: string,
  areaFallback = '',
  title = '',
): string {
  const { venue, prefecture: pref } = resolveVenueAndPrefectureFields(
    location,
    prefecture,
    areaFallback,
    title,
  )
  if (venue && venue !== pref) return venue
  if (venue) return venue
  return ''
}

export function formatPrefectureDisplay(
  prefecture: string,
  areaFallback = '',
  location = '',
  title = '',
): string {
  const { prefecture: pref } = resolveVenueAndPrefectureFields(
    location,
    prefecture,
    areaFallback,
    title,
  )
  return pref
}
