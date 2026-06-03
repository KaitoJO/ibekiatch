export const COMMUNITY_REGIONS = ['すべて', '三重', '名古屋', '愛知', '岐阜', 'その他'] as const

export const EVENT_REVIEW_TAGS = [
  '食系に強い',
  'スイーツ向き',
  'ドリンク向き',
  '初出店向け',
  'リピート向き',
  '家族連れ多い',
  '夜向き',
  '平日向き',
] as const

export type CommunityRegion = (typeof COMMUNITY_REGIONS)[number]
export type EventReviewTag = (typeof EVENT_REVIEW_TAGS)[number]

export function matchesCommunityRegion(areaOrRegion: string, region: string): boolean {
  if (region === 'すべて') return true
  const text = areaOrRegion.trim()
  if (!text) return region === 'その他'
  if (region === '三重') return /三重|津|四日市|伊勢|松阪|鈴鹿|桑名|伊賀|志摩|尾鷲|熊野|紀北|いなべ|菰野|多気|度会|大台|御浜|紀宝|東員|名張|鳥羽|朝日|川越|明和/.test(text)
  if (region === '名古屋') return /名古屋/.test(text)
  if (region === '愛知') return /愛知|名古屋|豊田|岡崎|一宮|瀬戸|知多|西尾|豊橋/.test(text)
  if (region === '岐阜') return /岐阜|大垣|多治見|高山|各務原/.test(text)
  return region === 'その他'
}
