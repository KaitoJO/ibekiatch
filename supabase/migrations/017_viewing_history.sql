-- 閲覧履歴 + my_events から「検討中」を廃止

CREATE TABLE IF NOT EXISTS public.viewing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  event_title text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS viewing_history_user_viewed_idx
  ON public.viewing_history (user_id, viewed_at DESC);

ALTER TABLE public.viewing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY viewing_history_select_own ON public.viewing_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY viewing_history_insert_own ON public.viewing_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 検討中レコードを削除し、ステータス制約を更新
DELETE FROM public.my_events WHERE status = '検討中';

ALTER TABLE public.my_events DROP CONSTRAINT IF EXISTS my_events_status_check;

ALTER TABLE public.my_events
  ALTER COLUMN status SET DEFAULT '応募中';

ALTER TABLE public.my_events
  ADD CONSTRAINT my_events_status_check
  CHECK (status IN ('応募中', '出店確定'));
