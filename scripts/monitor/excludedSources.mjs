/** 監視対象外（ニュース系）ソース — 収集・cron・DB から除外 */

export const EXCLUDED_NEWS_SOURCE_IDS = [
  'google_news',
  'chunichi',
  'chunichi_biz',
  'ise_shinbun',
  'local_fm',
  'news',
  'mie_news',
  'mie_fm',
]

export const EXCLUDED_NEWS_SOURCE_SET = new Set(EXCLUDED_NEWS_SOURCE_IDS)

export function isExcludedNewsSource(sourceId) {
  return EXCLUDED_NEWS_SOURCE_SET.has(sourceId)
}
