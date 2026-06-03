-- ユーザーが検討・応募中のイベント

CREATE TABLE IF NOT EXISTS public.my_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  recruitment_id uuid REFERENCES public.recruitments(id) ON DELETE SET NULL,
  ref_key text NOT NULL,
  event_date date,
  event_title text NOT NULL,
  event_location text NOT NULL DEFAULT '',
  event_area text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '検討中'
    CHECK (status IN ('検討中', '応募中', '出店確定')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ref_key)
);

CREATE INDEX IF NOT EXISTS my_events_user_status_idx
  ON public.my_events (user_id, status);

CREATE INDEX IF NOT EXISTS my_events_event_date_idx
  ON public.my_events (user_id, event_date);

ALTER TABLE public.my_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY my_events_select_own ON public.my_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY my_events_insert_own ON public.my_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY my_events_update_own ON public.my_events
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY my_events_delete_own ON public.my_events
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
