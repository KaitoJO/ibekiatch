-- AI 中優先機能: 主催者エンティティ・URL再チェック

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organizer_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS events_organizer_key_idx ON public.events (organizer_key)
  WHERE organizer_key <> '';

CREATE INDEX IF NOT EXISTS events_open_source_check_idx ON public.events (source_checked_at)
  WHERE status = 'open' AND source_url IS NOT NULL;
