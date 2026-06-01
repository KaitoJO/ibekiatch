-- キッチンカー出店情報のスクレイピング・監視

CREATE TABLE IF NOT EXISTS public.monitor_sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('rss', 'scrape', 'api')),
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.monitor_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES public.monitor_sources(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  title text NOT NULL,
  url text,
  snippet text NOT NULL DEFAULT '',
  matched_keywords text[] NOT NULL DEFAULT '{}',
  published_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);

CREATE INDEX IF NOT EXISTS monitor_hits_created_at_idx ON public.monitor_hits (created_at DESC);
CREATE INDEX IF NOT EXISTS monitor_hits_source_id_idx ON public.monitor_hits (source_id);
CREATE INDEX IF NOT EXISTS monitor_hits_keywords_idx ON public.monitor_hits USING gin (matched_keywords);

ALTER TABLE public.monitor_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY monitor_sources_select ON public.monitor_sources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY monitor_hits_select ON public.monitor_hits
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.monitor_sources (id, name, source_type, config) VALUES
  ('kokuchiz', 'こくちーず', 'rss', '{"feedPattern":"https://www.kokuchpro.com/s/q-{keyword}.rss"}'::jsonb),
  ('peatix', 'Peatix', 'scrape', '{"searchUrl":"https://peatix.com/search?q={keyword}"}'::jsonb),
  ('google_news', 'Googleニュース', 'rss', '{}'::jsonb),
  ('jmty', 'ジモティー', 'scrape', '{"searchUrl":"https://jmty.jp/articles/search?q={keyword}"}'::jsonb),
  ('twitter', 'X (Twitter)', 'api', '{}'::jsonb),
  ('instagram', 'Instagram', 'api', '{}'::jsonb),
  ('facebook', 'Facebook', 'api', '{}'::jsonb),
  ('mie_cities', '三重県 市町村公式HP', 'scrape', '{}'::jsonb),
  ('shokokai', '商工会・商工会議所', 'scrape', '{}'::jsonb),
  ('michinoeki', '道の駅', 'scrape', '{}'::jsonb),
  ('eventbank', 'イベントバンク', 'scrape', '{"searchUrl":"https://www.eventbank.jp/event/search?keyword={keyword}"}'::jsonb),
  ('maipure_mie', 'まいぷれ三重', 'scrape', '{"baseUrl":"https://mie.maipure.com"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
