/** 監視キーワード（RSS・Web一般） */
export const MONITOR_KEYWORDS = [
  'キッチンカー',
  '移動販売',
  'フードトラック',
  '出店募集',
  'マルシェ',
  '露天',
  '出店者募集',
  'キッチンカー募集',
  'フード出店',
]

/** SNS（X / Instagram / Threads）監視キーワード */
export const SNS_KEYWORDS = [
  'キッチンカー募集',
  '出店者募集',
  'マルシェ出店',
  'フードトラック募集',
  '移動販売募集',
  'キッチンカー 出店',
  'マルシェ 募集',
]

export const PLAYWRIGHT_SOCIAL_SOURCES = ['twitter', 'instagram', 'threads']

/** 三重県 市町村公式（イベント・お知らせページ） */
export const MIE_CITY_PAGES = [
  { id: 'tsu', name: '津市', urls: ['https://www.city.tsu.lg.jp/index.html'] },
  { id: 'yokkaichi', name: '四日市市', urls: ['https://www.city.yokkaichi.lg.jp/'] },
  { id: 'ise', name: '伊勢市', urls: ['https://www.city.ise.mie.jp/'] },
  { id: 'matsusaka', name: '松阪市', urls: ['https://www.city.matsusaka.mie.jp/'] },
  { id: 'suzuka', name: '鈴鹿市', urls: ['https://www.city.suzuka.lg.jp/'] },
  { id: 'kuwana', name: '桑名市', urls: ['https://www.city.kuwana.lg.jp/'] },
]

export const SHOKOKAI_PAGES = [
  { name: '三重県商工会連合会', url: 'https://www.mieshoko.or.jp/' },
  { name: '四日市商工会議所', url: 'https://www.yokkaichicc.or.jp/' },
  { name: '津商工会議所', url: 'https://www.tsucci.or.jp/' },
]

export const MICHINOEKI_PAGES = [
  { name: '道の駅公式', url: 'https://www.michi-no-eki.jp/' },
  { name: '道の駅お知らせ', url: 'https://www.michi-no-eki.jp/notices' },
  { name: '三重県観光イベント', url: 'https://www.kankomie.or.jp/event/' },
]

export const JMty_SEARCH_BASE =
  'https://jmty.jp/mie/search?keyword={keyword}&prefecture_name=mie&category_group={category}'

export const JMty_CATEGORIES = ['sale', 'rec']

export const MAIPURE_MIE_BASE = 'https://mie.mypl.net'

export const EVENTBANK_SEARCH =
  'https://www.google.com/search?q={keyword}&hl=ja'

export const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ibekiatch-monitor/1.0'

export const FETCH_TIMEOUT_MS = 20_000
