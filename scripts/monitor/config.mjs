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

export const PLAYWRIGHT_SOCIAL_SOURCES = ['twitter', 'instagram', 'threads', 'facebook']

/** 三重県 市町村公式（イベント・お知らせページを直接監視） */
export const MIE_CITY_PAGES = [
  {
    id: 'tsu',
    name: '津市',
    urls: [
      'https://www.info.city.tsu.mie.jp/',
      'https://www.info.city.tsu.mie.jp/newslist.html',
      'https://www.info.city.tsu.mie.jp/event_calendar.html',
    ],
  },
  {
    id: 'yokkaichi',
    name: '四日市市',
    urls: [
      'https://www.city.yokkaichi.lg.jp/',
      'https://www.city.yokkaichi.lg.jp/www/news.html',
      'https://yokkaichi-event.com/',
    ],
  },
  {
    id: 'ise',
    name: '伊勢市',
    urls: [
      'https://www.city.ise.mie.jp/',
      'https://www.city.ise.mie.jp/kankou/event/index.html',
      'https://www.city.ise.mie.jp/shisei/kouhou/index.html',
      'https://www.city.ise.mie.jp/machi/deai/deaievent/index.html',
    ],
  },
  {
    id: 'matsusaka',
    name: '松阪市',
    urls: [
      'https://www.city.matsusaka.mie.jp/',
      'https://www.city.matsusaka.mie.jp/site/kouhou/',
      'https://www.city.matsusaka.mie.jp/calendar/',
      'https://matsusaka-event.com/',
    ],
  },
  {
    id: 'suzuka',
    name: '鈴鹿市',
    urls: [
      'https://www.city.suzuka.lg.jp/',
      'https://www.city.suzuka.lg.jp/bunka/event/index.html',
      'https://www.city.suzuka.lg.jp/event_calendar.html',
      'https://www.city.suzuka.lg.jp/newslist.html',
    ],
  },
  {
    id: 'kuwana',
    name: '桑名市',
    urls: [
      'https://www.city.kuwana.lg.jp/',
      'https://www.city.kuwana.lg.jp/oshirase/index.html',
      'https://www.city.kuwana.lg.jp/cgi-bin/event_cal_multi/calendar.cgi',
      'https://www.city.kuwana.lg.jp/brand/event/j10.html',
    ],
  },
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

/** キッチンカー専門プラットフォーム */
export const KITCHEN_CAR_PORTAL_PAGES = [
  {
    id: 'mellow',
    name: 'MELLOW SHOP STOP',
    urls: [
      'https://www.mellow.jp/shopstop',
      'https://www.mellow.jp/',
    ],
  },
  {
    id: 'mobimaru',
    name: 'Mobimaru',
    urls: ['https://mobimaru.com/', 'https://mobimaru.com/event/'],
  },
  {
    id: 'madoguchi',
    name: 'キッチンカーの窓口',
    urls: [
      'https://k-car-madoguchi.co.jp/',
      'https://k-car-madoguchi.co.jp/service/event/',
      'https://k-car-madoguchi.co.jp/service/sales-support/',
    ],
  },
]

/** 商業施設（イオンモール・三重県内） */
export const AEON_MALL_PAGES = [
  { name: 'イオンモール', urls: ['https://www.aeonmall.com/'] },
  { name: 'イオンモール津南', urls: ['https://www.aeonmall.com/mall/tsuminami/'] },
  { name: 'イオンモール四日市北', urls: ['https://www.aeonmall.com/mall/yokkaichihigashi/'] },
  { name: 'イオンモール鈴鹿', urls: ['https://www.aeonmall.com/mall/suzuka/'] },
  { name: 'イオンモール東員', urls: ['https://www.aeonmall.com/mall/toin/'] },
]

export const OUTLET_MALL_PAGES = [
  { name: '三井アウトレットパーク', urls: ['https://www.mitsui-shopping-park.com/mop/'] },
  { name: 'ジャズドリーム長島', urls: ['https://www.jazzdream.co.jp/'] },
  { name: '長島スパ・ナガシマ', urls: ['https://www.nagashima-onsen.co.jp/'] },
]

/** 三重県内 観光協会・DMO */
export const MIE_TOURISM_PAGES = [
  { name: '三重県観光', urls: ['https://www.kankomie.or.jp/event/'] },
  { name: '伊勢観光', urls: ['https://www.ise-kanko.jp/'] },
  { name: '四日市観光', urls: ['https://www.yokkaichi-kanko.org/'] },
  { name: '津観光', urls: ['https://www.tsukanko.jp/'] },
  { name: '松阪観光', urls: ['https://www.matsusaka-kanko.jp/'] },
  { name: '鈴鹿観光', urls: ['https://www.suzuka-kanko.jp/'] },
  { name: '桑名観光', urls: ['https://www.kuwana-kanko.jp/'] },
  { name: '鳥羽観光', urls: ['https://www.toba-kanko.jp/'] },
  { name: '志摩観光', urls: ['https://www.kanko-shima.com/'] },
  { name: '伊賀観光', urls: ['https://www.iga-kankou.jp/'] },
  { name: '名張観光', urls: ['https://www.nabari-kanko.jp/'] },
  { name: '尾鷲観光', urls: ['https://www.owase-kanko.jp/'] },
  { name: '熊野観光', urls: ['https://www.kumano-kanko.jp/'] },
  { name: '紀北観光', urls: ['https://www.kihoku-kanko.jp/'] },
  { name: 'いなべ観光', urls: ['https://www.inabe-kanko.jp/'] },
  { name: '菰野観光', urls: ['https://www.komono-kanko.jp/'] },
  { name: '朝日観光', urls: ['https://www.asahi-kanko.jp/'] },
  { name: '川越観光', urls: ['https://www.kawagoe-kanko.jp/'] },
  { name: '多気観光', urls: ['https://www.taki-kanko.jp/'] },
  { name: '明和観光', urls: ['https://www.meiwakanko.jp/'] },
  { name: '度会観光', urls: ['https://www.watarai-kanko.jp/'] },
  { name: '大台観光', urls: ['https://www.odai-kanko.jp/'] },
  { name: '御浜観光', urls: ['https://www.mihama-kanko.jp/'] },
  { name: '紀宝観光', urls: ['https://www.kiho-kanko.jp/'] },
  { name: '東員観光', urls: ['https://www.toin-kanko.jp/'] },
]

/** 新聞・メディア */
export const MIE_NEWS_PAGES = [
  { name: '伊勢新聞', urls: ['https://www.isenp.co.jp/'] },
  { name: '中日新聞三重', urls: ['https://www.chunichi.co.jp/local/mie/'] },
]

export const MIE_FM_PAGES = [
  { name: 'レディオキューブFM三重', urls: ['https://fmmie.jp/', 'https://fmmie.jp/programs/'] },
]

export const JA_MIE_PAGES = [
  { name: 'JA三重', urls: ['https://www.ja-mie.or.jp/'] },
  { name: 'JAみえなみ', urls: ['https://www.jamienami.or.jp/'] },
  { name: 'JAいが', urls: ['https://www.jaiga.or.jp/'] },
]
