import { createHash } from 'node:crypto'
import { normalizeText } from './urlUtils.mjs'

const ORGANIZER_NOISE_RE = [
  /^主催[:：]?\s*/i,
  /^運営[:：]?\s*/i,
  /(?:株式会社|有限会社|合同会社|一般社団法人|NPO)/g,
  /[\s　・｜|/\\\-–—()（）【】\[\]「」『』]/g,
]

const TITLE_SUFFIX_RE = /(?:マルシェ|フェス|フードフェス|イベント|出店募集|キッチンカー).{0,12}$/

/**
 * 表記ゆれを吸収した主催者キー（同一イベント予測・重複検出用）
 */
export function normalizeOrganizerKey(organizer, title = '') {
  let raw = (organizer ?? '').trim()
  if (!raw) {
    const fromTitle = (title ?? '').replace(/^\[[^\]]+\]\s*/, '').replace(TITLE_SUFFIX_RE, '').trim()
    raw = fromTitle.slice(0, 40)
  }
  if (!raw) return ''

  let normalized = raw
  for (const re of ORGANIZER_NOISE_RE) {
    normalized = normalized.replace(re, '')
  }
  normalized = normalizeText(normalized).toLowerCase()
  if (!normalized) return ''

  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export function pickOrganizerLabel(organizer, title) {
  const org = normalizeText(organizer)
  if (org) return org
  const cleaned = (title ?? '').replace(/^\[[^\]]+\]\s*/, '').trim()
  return cleaned.slice(0, 80)
}
