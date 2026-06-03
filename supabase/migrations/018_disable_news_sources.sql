-- ニュース系ソースを監視対象外にし、関連データを削除

UPDATE public.monitor_sources
SET enabled = false
WHERE id IN (
  'google_news',
  'chunichi',
  'chunichi_biz',
  'ise_shinbun',
  'local_fm',
  'news',
  'mie_news',
  'mie_fm'
);

DELETE FROM public.events
WHERE source_id IN (
  'google_news',
  'chunichi',
  'chunichi_biz',
  'ise_shinbun',
  'local_fm',
  'news',
  'mie_news',
  'mie_fm'
);

DELETE FROM public.monitor_hits
WHERE source_id IN (
  'google_news',
  'chunichi',
  'chunichi_biz',
  'ise_shinbun',
  'local_fm',
  'news',
  'mie_news',
  'mie_fm'
);
