-- Threads 自動投稿履歴

create table if not exists public.threads_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  slot text not null check (slot in ('morning', 'noon', 'night')),
  text text not null,
  thread_id text,
  posted_at timestamptz not null default now(),
  status text not null default 'posted' check (status in ('posted', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists threads_posts_posted_at_idx
  on public.threads_posts (posted_at desc);

create unique index if not exists threads_posts_event_unique_idx
  on public.threads_posts (event_id)
  where event_id is not null and status = 'posted';

alter table public.threads_posts enable row level security;

create policy threads_posts_select_public on public.threads_posts
  for select to anon, authenticated
  using (true);
