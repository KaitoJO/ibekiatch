/** 東海地方（三重・静岡・愛知・岐阜）— クライアント側フィルタ */

export {
  TOKAI_PREFECTURES,
  isTokaiRegionText,
  resolvePrefectureFromText,
  resolveVenueAndPrefectureFields,
  formatVenueDisplay,
  formatPrefectureDisplay,
} from './prefectureResolve'

import { isTokaiRegionText } from './prefectureResolve'

const MIE_SOURCES = new Set([
  'mie_cities', 'mie_tourism', 'ja_mie', 'maipure_mie',
  'shokokai', 'michinoeki', 'aeon_mall', 'outlet_mall',
])

type TokaiEventLike = {
  title: string
  location: string
  area: string
  prefecture?: string
  description?: string
  sourceId?: string | null
}

export function isTokaiDisplayEvent(event: TokaiEventLike): boolean {
  if (event.sourceId && MIE_SOURCES.has(event.sourceId)) return true
  return isTokaiRegionText(
    event.title,
    event.location,
    event.prefecture ?? '',
    event.area,
    event.description ?? '',
  )
}
