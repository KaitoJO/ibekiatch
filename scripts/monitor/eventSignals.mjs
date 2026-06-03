/**
 * ルールベースのイベントシグナルスコアリング（AI分析の前段）
 *
 * 方針: イベントの「存在判定・開催日判定・スコアリング」はルールで行う。
 * AI はカテゴリ分類・要約・魅力度などの分析のみを担当する。
 *
 * スコア表（仕様）:
 *   募集キーワード一致     +（最大40 / 除外・終了は -100）
 *   開催日あり            +30
 *   開催日が未来          +30
 *   公式サイト            +20
 *   応募フォーム/応募導線   +20
 *   Instagram 投稿        +10
 *   最近更新（45日以内）    +10
 *   開催レポート/終了      -100
 *   開催日が過去          -100
 *   日時不明              -30
 *
 * 通知（掲載）しきい値: NOTIFY_SCORE_MIN
 */

import { scoreRecruitmentText } from './keywordScoring.mjs'
import { extractDatesFromText } from './dateExtraction.mjs'
import { todayInJstDateKey } from './recruitmentStatus.mjs'

/** これ以上で AI 分析へ進める（AI コスト節約のための前段ゲート） */
export const AI_GATE_SCORE_MIN = 40
/** これ以上で掲載・通知する */
export const NOTIFY_SCORE_MIN = 70

const OFFICIAL_SITE_SOURCES = new Set([
  'mie_cities',
  'shokokai',
  'michinoeki',
  'aeon_mall',
  'outlet_mall',
  'mie_tourism',
  'ja_mie',
  'kitchencar_madoguchi',
])

const EVENT_PLATFORM_SOURCES = new Set([
  'kokuchiz',
  'peatix',
  'eventbank',
  'jmty',
  'maipure_mie',
  'mellow_shopstop',
  'mobimaru',
])

const REPORT_ARCHIVE_RE =
  /開催レポート|開催報告|開催記録|イベントレポート|レポート公開|昨年の様子|去年の様子|過去の様子|今年も開催されました|無事終了|盛況のうち|アーカイブ|過去開催|開催されました|来場ありがとう|ご来場ありがとう/

const APPLICATION_FORM_RE =
  /応募フォーム|申込フォーム|エントリーフォーム|応募はこちら|お申し込みはこちら|エントリーはこちら|申込はこちら|応募受付中|エントリー受付中/

const FORM_URL_RE = /(?:docs\.google\.com\/forms|forms\.gle|form|entry|apply|application|エントリー)/i

/** 明確な「出店者募集」フレーズ（これがあればイベント存在は確定扱い） */
const EXPLICIT_RECRUITMENT_RE =
  /出店者(?:を|の)?募集|出店募集|キッチンカー(?:を)?募集|フードトラック募集|露店募集|露天募集|事業者募集|マルシェ出店者|出店店舗募集|出店ブース募集|出店車両募集|出店業者募集/

/** SNS など、構造化日付が無いことが多いソース */
export function isSnsSourceType(sourceType) {
  return sourceType === 'instagram' || sourceType === 'x'
}

/** 明確な出店者募集フレーズを含むか（決定論的な存在判定） */
export function isExplicitRecruitment(title = '', snippet = '') {
  return EXPLICIT_RECRUITMENT_RE.test(`${title}\n${snippet}`)
}

/** @returns {'official_site'|'event_platform'|'instagram'|'x'|'other'} */
export function sourceTypeOf(sourceId = '') {
  if (sourceId === 'instagram') return 'instagram'
  if (sourceId === 'twitter') return 'x'
  if (OFFICIAL_SITE_SOURCES.has(sourceId)) return 'official_site'
  if (EVENT_PLATFORM_SOURCES.has(sourceId)) return 'event_platform'
  return 'other'
}

export function hasReportOrArchiveText(title = '', snippet = '') {
  return REPORT_ARCHIVE_RE.test(`${title}\n${snippet}`)
}

function isRecentlyUpdated(createdAt, today = todayInJstDateKey()) {
  if (!createdAt) return false
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return false
  const todayMs = new Date(`${today}T00:00:00+09:00`).getTime()
  const days = (todayMs - created.getTime()) / (1000 * 60 * 60 * 24)
  return days <= 45
}

/**
 * 決定論的に開催日を抽出（AI には頼らない）
 * @returns {{ eventDate: string|null, recruitEnd: string|null, recruitStart: string|null }}
 */
export function extractEventDate(title = '', snippet = '') {
  const { event_date, recruit_start, recruit_end } = extractDatesFromText(`${title}\n${snippet}`)
  return { eventDate: event_date, recruitStart: recruit_start, recruitEnd: recruit_end }
}

/**
 * ルールベースのシグナルスコアを算出
 * @param {{
 *   title?: string,
 *   snippet?: string,
 *   sourceId?: string,
 *   eventDate?: string|null,
 *   applicationUrl?: string|null,
 *   createdAt?: string|null,
 *   today?: string,
 * }} input
 * @returns {{ score: number, reasons: string[], sourceType: string }}
 */
export function scoreEventSignals(input = {}) {
  const {
    title = '',
    snippet = '',
    sourceId = '',
    eventDate = null,
    applicationUrl = null,
    createdAt = null,
    today = todayInJstDateKey(),
  } = input

  const text = `${title}\n${snippet}`
  const reasons = []
  let score = 0

  // 募集キーワード（正例 + 除外/終了の負例）。正例は +40 で頭打ち。
  const kw = scoreRecruitmentText(title, snippet)
  const kwClamped = kw > 40 ? 40 : kw
  score += kwClamped
  reasons.push(`募集キーワード${kwClamped >= 0 ? '+' : ''}${kwClamped}`)

  const sourceType = sourceTypeOf(sourceId)
  const sns = isSnsSourceType(sourceType)

  // 開催日（SNS は構造化日付が無いことが多く、日時不明でも減点しない）
  if (eventDate) {
    score += 30
    reasons.push('開催日あり+30')
    if (eventDate >= today) {
      score += 30
      reasons.push('未来開催+30')
    } else {
      score -= 100
      reasons.push('過去開催-100')
    }
  } else if (!sns) {
    score -= 30
    reasons.push('日時不明-30')
  }

  // 明確な出店者募集フレーズ
  if (EXPLICIT_RECRUITMENT_RE.test(text)) {
    score += 20
    reasons.push('明確な募集+20')
  }

  // ソース種別
  if (sourceType === 'official_site') {
    score += 20
    reasons.push('公式サイト+20')
  } else if (sourceType === 'instagram') {
    score += 10
    reasons.push('Instagram+10')
  } else if (sourceType === 'x') {
    score += 10
    reasons.push('X+10')
  }

  // 応募導線
  if (APPLICATION_FORM_RE.test(text) || (applicationUrl && FORM_URL_RE.test(applicationUrl))) {
    score += 20
    reasons.push('応募フォーム+20')
  }

  // 最近更新
  if (isRecentlyUpdated(createdAt, today)) {
    score += 10
    reasons.push('最近更新+10')
  }

  // 開催レポート/アーカイブ
  if (REPORT_ARCHIVE_RE.test(text)) {
    score -= 100
    reasons.push('開催レポート-100')
  }

  return { score, reasons, sourceType }
}
