import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {{ hints: string[], cityLabel: string, prefecture: string, exclude?: string[] }[]} */
const TOKAI_CITIES = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/tokai-cities.json'), 'utf8'),
)
const EXTRA_CITIES = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/japan-cities-extra.json'), 'utf8'),
)
const CITY_ENTRIES = [...TOKAI_CITIES, ...EXTRA_CITIES]

export const TOKAI_PREFECTURES = ['三重県', '静岡県', '愛知県', '岐阜県']

const PREF_RE = [
  { pref: '三重県', re: /三重県?/ },
  { pref: '静岡県', re: /静岡県?/ },
  { pref: '愛知県', re: /愛知県?/ },
  { pref: '岐阜県', re: /岐阜県?/ },
  { pref: '大阪府', re: /大阪[府県]?/ },
  { pref: '京都府', re: /京都[府県]?/ },
  { pref: '兵庫県', re: /兵庫県?/ },
  { pref: '神奈川県', re: /神奈川県?/ },
  { pref: '東京都', re: /東京都?/ },
]

const SORTED_CITY_ENTRIES = [...CITY_ENTRIES].sort(
  (a, b) => Math.max(...b.hints.map((h) => h.length)) - Math.max(...a.hints.map((h) => h.length)),
)

export function normalizeLocationBlob(...parts) {
  return parts
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, ' ')
}

function matchesCityEntry(blob, entry) {
  if (!entry.hints.some((hint) => blob.includes(hint))) return false
  if (entry.exclude?.some((ex) => blob.includes(ex))) return false
  if (entry.cityLabel === '岡崎市' && /京都/.test(blob) && !/愛知|岡崎市/.test(blob)) return false
  return true
}

/**
 * @returns {{ cityLabel: string, prefecture: string } | null}
 */
export function matchCityFromText(blob) {
  for (const entry of SORTED_CITY_ENTRIES) {
    if (matchesCityEntry(blob, entry)) {
      return { cityLabel: entry.cityLabel, prefecture: entry.prefecture }
    }
  }
  return null
}

/**
 * @returns {{ cityLabel: string, prefecture: string } | null}
 */
export function matchPrefectureFromText(blob) {
  const city = matchCityFromText(blob)
  if (city) return city

  for (const { pref, re } of PREF_RE) {
    if (re.test(blob)) return { cityLabel: pref, prefecture: pref }
  }
  return null
}

/**
 * venue（会場・市区町村）と prefecture を分離
 * @param {{ location?: string, title?: string, snippet?: string, sourceId?: string }} input
 */
export function resolveVenueAndPrefecture(input = {}) {
  const blob = normalizeLocationBlob(input.title, input.location, input.snippet)
  let venue = (input.location ?? '').trim()
  const matched = matchPrefectureFromText(blob)
  let prefecture = matched?.prefecture ?? ''

  if (!venue && matched && matched.cityLabel !== matched.prefecture) {
    venue = matched.cityLabel
  }

  if (!prefecture) {
    for (const { pref, re } of PREF_RE) {
      if (re.test(venue)) {
        prefecture = pref
        break
      }
    }
  }

  // venue に都道府県名だけが入っている場合は分離
  if (venue && PREF_RE.some(({ pref }) => venue === pref || venue === pref.replace('県', ''))) {
    if (!prefecture) prefecture = venue.endsWith('県') ? venue : `${venue}県`
    venue = matched?.cityLabel !== prefecture ? matched?.cityLabel ?? '' : ''
  }

  return { venue, prefecture }
}
