-- ibekiatch: キッチンカー出店マッチング（RLS で本人データを保護）
-- Supabase SQL Editor に貼り付けて実行するか、CLI で migration として適用してください。

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles（キッチンカー事業者プロフィール）
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text default '',
  business_name text default '',
  genre text default '',
  area text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_user_id_idx on public.profiles (user_id);

-- ---------------------------------------------------------------------------
-- recruitments（出店募集 — ログインユーザー全員が閲覧可）
-- ---------------------------------------------------------------------------
create table public.recruitments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  venue text not null,
  area text not null,
  genre text not null,
  event_date date not null,
  time_slot text not null,
  fee integer not null,
  max_applicants integer not null default 10,
  is_urgent boolean not null default false,
  image_gradient text not null default 'linear-gradient(135deg, #FF8A50 0%, #FF6B35 100%)',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index recruitments_area_idx on public.recruitments (area);
create index recruitments_genre_idx on public.recruitments (genre);
create index recruitments_event_date_idx on public.recruitments (event_date);

-- ---------------------------------------------------------------------------
-- applications（応募 — 本人のみ参照・作成）
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recruitment_id uuid not null references public.recruitments (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, recruitment_id)
);

create index applications_user_id_idx on public.applications (user_id);
create index applications_recruitment_id_idx on public.applications (recruitment_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.recruitments enable row level security;
alter table public.applications enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = user_id);

-- recruitments（認証済みユーザーは有効な募集を閲覧）
create policy "recruitments_select_authenticated" on public.recruitments
  for select using (auth.uid() is not null and is_active = true);

-- applications
create policy "applications_select_own" on public.applications for select using (auth.uid() = user_id);
create policy "applications_insert_own" on public.applications for insert with check (auth.uid() = user_id);
create policy "applications_delete_own" on public.applications for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 新規登録時に profiles 行を自動作成
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
