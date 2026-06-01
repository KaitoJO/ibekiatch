-- サンプル出店募集データ（001 実行後に適用）
-- SQL Editor で Run するか CLI migration として適用してください。

insert into public.recruitments (
  title, venue, area, genre, event_date, time_slot, fee, max_applicants, is_urgent, image_gradient
) values
  (
    '週末フードフェス出店枠',
    '代々木公園 イベント広場',
    '東京23区',
    '焼肉・BBQ',
    '2026-06-07',
    '10:00 – 18:00',
    85000,
    8,
    true,
    'linear-gradient(135deg, #FF8A50 0%, #FF6B35 50%, #E85D04 100%)'
  ),
  (
    'オフィス街ランチ出店',
    '丸の内ビルディング 前広場',
    '東京23区',
    'カフェ',
    '2026-06-05',
    '11:00 – 14:00',
    42000,
    5,
    false,
    'linear-gradient(135deg, #FFB347 0%, #FF8C42 100%)'
  ),
  (
    '港南台駅前 ナイトマーケット',
    '港南台駅 西口ロータリー',
    '横浜',
    'スイーツ',
    '2026-06-08',
    '16:00 – 21:00',
    55000,
    6,
    false,
    'linear-gradient(135deg, #FF9A76 0%, #FF6B6B 100%)'
  ),
  (
    '企業フェスティバル出店',
    '大阪ビジネスパーク',
    '大阪',
    'エスニック',
    '2026-06-12',
    '10:00 – 17:00',
    72000,
    10,
    false,
    'linear-gradient(135deg, #F4A261 0%, #E76F51 100%)'
  ),
  (
    '夏祭りキッチンカーゾーン',
    '名古屋港 ガーデンふ頭',
    '名古屋',
    'ラーメン',
    '2026-06-15',
    '12:00 – 20:00',
    98000,
    12,
    true,
    'linear-gradient(135deg, #FF7B54 0%, #FFB26B 100%)'
  ),
  (
    'ショッピングモール常設枠',
    'ららぽーと福岡',
    '福岡',
    'その他',
    '2026-06-20',
    '10:00 – 19:00',
    65000,
    4,
    false,
    'linear-gradient(135deg, #FFD166 0%, #FF6B35 100%)'
  );
