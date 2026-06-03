/** ニュース系ソース向け：記事本文から開催年を判定し古い記事を除外 */

import { todayInJstDateKey } from './recruitmentStatus.mjs'

export const NEWS_SOURCE_IDS = new Set(['google_news', 'mie_news', 'mie_fm'])

function currentYearJst() {
  return parseInt(todayInJstDateKey().slice(0, 4), 10)
}

/** 開催日として使われがちな年（現在年より前） */
function pastEventYears(currentYear) {
  const years = []
  for (let y = 2022; y < currentYear; y++) years.push(y)
  return years
}

/**
 * 記事本文から開催年らしい西暦を抽出
 * @returns {number[]}
 */
export function extractEventYearsFromNewsText(...parts) {
  const blob = parts.filter(Boolean).join('\n')
  const years = new Set()

  for (const m of blob.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)) years.add(+m[1])
  for (const m of blob.matchAll(/(\d{4})年(\d{1,2})月/g)) years.add(+m[1])
  for (const m of blob.matchAll(/(\d{4})[\/／-](\d{1,2})[\/／-](\d{1,2})/g)) years.add(+m[1])
  for (const m of blob.matchAll(/(\d{4})年(?:の)?(?:春|夏|秋|冬|上旬|中旬|下旬)/g)) years.add(+m[1])
  for (const m of blob.matchAll(/(?:開催|実施|イベント|マルシェ|祭|フェス).{0,24}(\d{4})年/g)) {
    years.add(+m[1])
  }
  for (const m of blob.matchAll(/(\d{4})年.{0,24}(?:開催|実施|イベント|マルシェ)/g)) {
    years.add(+m[1])
  }

  return [...years]
}

/** 指定年が開催日として記載されているか */
function hasYearAsEventDate(blob, year) {
  const y = String(year)
  if (new RegExp(`${y}年\\d{1,2}月\\d{1,2}日`).test(blob)) return true
  if (new RegExp(`${y}年\\d{1,2}月`).test(blob)) return true
  if (new RegExp(`${y}[\\/／-]\\d{1,2}[\\/／-]\\d{1,2}`).test(blob)) return true
  if (new RegExp(`${y}年(?:の)?(?:開催|実施|イベント|マルシェ|祭|フェス)`).test(blob)) return true
  if (new RegExp(`(?:開催|実施|イベント|マルシェ).{0,20}${y}年`).test(blob)) return true
  return false
}

/**
 * ニュース記事をスキップすべきか
 * - 2022〜(現在年-1) が開催日として含まれる → スキップ
 * - 抽出した開催年が現在年以外 → スキップ
 * - 年の記載がない → 保存OK
 */
export function shouldSkipNewsArticle(title, snippet, currentYear = currentYearJst()) {
  const blob = [title, snippet].filter(Boolean).join('\n')
  if (!blob.trim()) return false

  for (const y of pastEventYears(currentYear)) {
    if (hasYearAsEventDate(blob, y)) return true
  }

  const eventYears = extractEventYearsFromNewsText(title, snippet)
  if (eventYears.length === 0) return false

  return eventYears.some((y) => y !== currentYear)
}
