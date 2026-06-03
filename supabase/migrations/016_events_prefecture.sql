-- 会場 (location) と都道府県 (prefecture) を分離

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS prefecture text NOT NULL DEFAULT '';

-- 既存: area に県名が入っていれば prefecture へ
UPDATE public.events
SET prefecture = area
WHERE prefecture = '' AND area ~ '県$';

-- area はフィルタ用に都道府県へ統一（市区町村は location に残す）
UPDATE public.events
SET area = prefecture
WHERE prefecture <> '' AND area <> prefecture AND area ~ '(市|町|村)$';

CREATE INDEX IF NOT EXISTS events_prefecture_idx ON public.events (prefecture);
