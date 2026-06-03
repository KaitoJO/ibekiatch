export const APP_NAME = 'イベキャッチ'
export const APP_TAGLINE = '出店場所を、AIが見つける'
export const APP_DESCRIPTION =
  'キッチンカー・移動販売・露天営業者向けに、出店募集情報をAIが自動収集して通知するWebアプリ'

export const MONITOR_SOURCES = [
  'こくちーず',
  'Peatix',
  'Googleニュース',
  'ジモティー',
  'X',
  'Instagram',
  'Threads',
  'Facebook',
  '市町村HP',
  '商工会HP',
  '道の駅HP',
  'イベントバンク',
  'まいぷれ三重',
  'MELLOW SHOP STOP',
  'Mobimaru',
  'キッチンカーの窓口',
  'イオンモール',
  'アウトレット',
  '観光協会',
  '新聞',
  '三重FM',
  'JA三重',
] as const

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: '無料',
    price: 0,
    priceLabel: '¥0',
    features: ['新着8件まで閲覧', 'コミュニティ閲覧'],
  },
  {
    id: 'standard',
    name: 'スタンダード',
    price: 1200,
    priceLabel: '¥1,200/月',
    features: ['全募集の閲覧', 'プッシュ通知', 'エリアフィルター'],
    recommended: true,
  },
  {
    id: 'premium',
    name: 'プレミアム',
    price: 2980,
    priceLabel: '¥2,980/月',
    features: ['スタンダードの全機能', '優先通知', '応募サポート', '出店確定時のX自動投稿'],
  },
] as const

export const REGION_LABEL = '東海地方'

/** 無料プランでホームに表示する AI 収集件数 */
export const FREE_AI_HIT_LIMIT = 8
