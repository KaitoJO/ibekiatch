-- 出店済みイベントの口コミ・評価・イベント別チャット

create table if not exists public.event_reviews (
  id uuid primary key default gen_random_uuid(),
  recruitment_id uuid not null references public.recruitments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  rating_sales smallint not null check (rating_sales between 1 and 5),
  rating_traffic smallint not null check (rating_traffic between 1 and 5),
  rating_organizer smallint not null check (rating_organizer between 1 and 5),
  body text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (recruitment_id, user_id)
);

create index if not exists event_reviews_recruitment_id_idx
  on public.event_reviews (recruitment_id);

create index if not exists event_reviews_created_at_idx
  on public.event_reviews (created_at desc);

create table if not exists public.event_chat_messages (
  id uuid primary key default gen_random_uuid(),
  recruitment_id uuid not null references public.recruitments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists event_chat_messages_recruitment_id_idx
  on public.event_chat_messages (recruitment_id, created_at);

alter table public.community_posts
  add column if not exists recruitment_id uuid references public.recruitments(id) on delete set null,
  add column if not exists region text not null default '';

create or replace function public.user_can_access_event_chat(p_recruitment_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.applications
    where recruitment_id = p_recruitment_id
      and user_id = p_user_id
      and status = 'accepted'
  )
  or exists (
    select 1
    from public.event_reviews
    where recruitment_id = p_recruitment_id
      and user_id = p_user_id
  );
$$;

alter table public.event_reviews enable row level security;
alter table public.event_chat_messages enable row level security;

create policy "event_reviews_select_all"
  on public.event_reviews for select
  to authenticated
  using (true);

create policy "event_reviews_insert_own"
  on public.event_reviews for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.applications
      where recruitment_id = event_reviews.recruitment_id
        and user_id = auth.uid()
        and status = 'accepted'
    )
  );

create policy "event_reviews_update_own"
  on public.event_reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "event_chat_select"
  on public.event_chat_messages for select
  to authenticated
  using (public.user_can_access_event_chat(recruitment_id, auth.uid()));

create policy "event_chat_insert"
  on public.event_chat_messages for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.user_can_access_event_chat(recruitment_id, auth.uid())
  );
