-- SNS Playwright 監視ソース（X / Instagram / Threads）

INSERT INTO public.monitor_sources (id, name, source_type, config) VALUES
  ('threads', 'Threads', 'scrape', '{"engine":"playwright"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  config = EXCLUDED.config;

UPDATE public.monitor_sources SET
  name = 'X (Twitter)',
  source_type = 'scrape',
  config = '{"engine":"playwright"}'::jsonb
WHERE id = 'twitter';

UPDATE public.monitor_sources SET
  name = 'Instagram',
  source_type = 'scrape',
  config = '{"engine":"playwright"}'::jsonb
WHERE id = 'instagram';
