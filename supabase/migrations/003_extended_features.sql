-- ibekiatch: 通知・コミュニティ・募集詳細
-- 001 / 002 適用後に npm run db:push で実行

-- 募集詳細テキスト
alter table public.recruitments
  add column if not exists description text not null default '';

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('application', 'recruitment', 'community', 'system')),
  title text not null,
  body text not null default '',
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_is_read_idx on public.notifications (is_read);

-- ---------------------------------------------------------------------------
-- community_posts
-- ---------------------------------------------------------------------------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  title text not null,
  body text not null,
  area text not null default '',
  genre text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists community_posts_created_at_idx on public.community_posts (created_at desc);

-- ---------------------------------------------------------------------------
-- community_reviews
-- ---------------------------------------------------------------------------
create table if not exists public.community_reviews (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  rating integer not null check (rating >= 1 and rating <= 5),
  body text not null default '',
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists community_reviews_post_id_idx on public.community_reviews (post_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_reviews enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_insert_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;

create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_insert_own" on public.notifications for insert with check (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications_delete_own" on public.notifications for delete using (auth.uid() = user_id);

drop policy if exists "community_posts_select_authenticated" on public.community_posts;
drop policy if exists "community_posts_insert_own" on public.community_posts;
drop policy if exists "community_posts_update_own" on public.community_posts;
drop policy if exists "community_posts_delete_own" on public.community_posts;

create policy "community_posts_select_authenticated" on public.community_posts
  for select using (auth.uid() is not null);
create policy "community_posts_insert_own" on public.community_posts
  for insert with check (auth.uid() = user_id);
create policy "community_posts_update_own" on public.community_posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "community_posts_delete_own" on public.community_posts
  for delete using (auth.uid() = user_id);

drop policy if exists "community_reviews_select_authenticated" on public.community_reviews;
drop policy if exists "community_reviews_insert_own" on public.community_reviews;
drop policy if exists "community_reviews_update_own" on public.community_reviews;
drop policy if exists "community_reviews_delete_own" on public.community_reviews;

create policy "community_reviews_select_authenticated" on public.community_reviews
  for select using (auth.uid() is not null);
create policy "community_reviews_insert_own" on public.community_reviews
  for insert with check (auth.uid() = user_id);
create policy "community_reviews_update_own" on public.community_reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "community_reviews_delete_own" on public.community_reviews
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 応募時に通知を自動作成
-- ---------------------------------------------------------------------------
create or replace function public.notify_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r_title text;
begin
  select title into r_title from public.recruitments where id = new.recruitment_id;
  insert into public.notifications (user_id, type, title, body, related_id)
  values (
    new.user_id,
    'application',
    '応募を受け付けました',
    coalesce(r_title, '出店募集') || ' への応募が完了しました。結果をお待ちください。',
    new.recruitment_id
  );
  return new;
end;
$$;

drop trigger if exists on_application_created on public.applications;
create trigger on_application_created
  after insert on public.applications
  for each row execute function public.notify_application_submitted();

-- 新規ユーザー向けウェルカム通知
create or replace function public.notify_welcome_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body)
  values (
    new.user_id,
    'system',
    'ibekiatch へようこそ 🚚',
    'プロフィールを設定して、気になる出店募集に応募してみましょう。'
  );
  return new;
end;
$$;

drop trigger if exists on_profile_created_notify on public.profiles;
create trigger on_profile_created_notify
  after insert on public.profiles
  for each row execute function public.notify_welcome_user();

-- 既存募集に説明文を追加
update public.recruitments set description = '週末の大型フードフェスでの出店枠です。多くの来場者が見込める人気イベント。電源・給排水の利用可。' where title = '週末フードフェス出店枠' and description = '';
update public.recruitments set description = '平日ランチタイムのオフィスワーカー向け出店。回転率が高く、テイクアウトメニューが人気です。' where title = 'オフィス街ランチ出店' and description = '';
update public.recruitments set description = '駅前ナイトマーケットでの出店募集。夕方から夜にかけて家族連れが多いエリアです。' where title = '港南台駅前 ナイトマーケット' and description = '';
update public.recruitments set description = '企業フェス向けの出店枠。社員約3,000名規模のイベントです。' where title = '企業フェスティバル出店' and description = '';
update public.recruitments set description = '夏祭り会場のキッチンカーゾーン。海辺の開放的なロケーションです。' where title = '夏祭りキッチンカーゾーン' and description = '';
update public.recruitments set description = 'ショッピングモール内の常設出店枠。安定した集客が見込めます。' where title = 'ショッピングモール常設枠' and description = '';
