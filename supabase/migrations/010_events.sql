-- 構造化イベント（AI収集 + 将来の主催者投稿）

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_hit_id uuid REFERENCES public.monitor_hits(id) ON DELETE SET NULL,
  recruitment_id uuid REFERENCES public.recruitments(id) ON DELETE SET NULL,
  source_id text REFERENCES public.monitor_sources(id) ON DELETE SET NULL,
  origin text NOT NULL DEFAULT 'collected' CHECK (origin IN ('collected', 'host')),
  title text NOT NULL,
  organizer text NOT NULL DEFAULT '',
  location text NOT NULL,
  area text NOT NULL DEFAULT '三重県',
  event_date date,
  recruit_start date,
  recruit_end date,
  fee text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  application_url text,
  source_url text,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  confidence smallint NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  keyword_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS events_monitor_hit_id_unique_idx
  ON public.events (monitor_hit_id);

CREATE UNIQUE INDEX IF NOT EXISTS events_recruitment_id_idx
  ON public.events (recruitment_id)
  WHERE recruitment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_status_created_idx
  ON public.events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS events_area_idx ON public.events (area);
CREATE INDEX IF NOT EXISTS events_recruit_end_idx ON public.events (recruit_end)
  WHERE status = 'open';

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_select_public ON public.events
  FOR SELECT TO anon, authenticated
  USING (true);

-- service role が monitor から INSERT/UPDATE
