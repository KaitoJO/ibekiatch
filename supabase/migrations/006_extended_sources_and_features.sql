-- 新監視ソース登録・ダミー募集非表示・通知/応募/プロフィール拡張

-- サンプル募集（東京等）を非表示
update public.recruitments
set is_active = false
where area in ('東京23区', '横浜', '大阪', '名古屋', '福岡');

alter table public.recruitments
  add column if not exists source_url text;

alter table public.notifications
  add column if not exists action_url text;

alter table public.applications
  add column if not exists confirmed_at timestamptz;

alter table public.profiles
  add column if not exists subscription_plan text not null default 'free'
    check (subscription_plan in ('free', 'standard', 'premium'));

alter table public.profiles
  add column if not exists x_auto_post boolean not null default false;

-- 本人の応募ステータス更新（出店確定）
drop policy if exists "applications_update_own" on public.applications;
create policy "applications_update_own" on public.applications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.notify_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r_title text;
  r_url text;
begin
  select title, source_url into r_title, r_url
  from public.recruitments where id = new.recruitment_id;
  insert into public.notifications (user_id, type, title, body, related_id, action_url)
  values (
    new.user_id,
    'application',
    '応募サイトへのリンクを確認してください',
    coalesce(r_title, '出店募集') || ' — 募集元サイトで応募手続きを進めてください。',
    new.recruitment_id,
    r_url
  );
  return new;
end;
$$;

insert into public.monitor_sources (id, name, source_type, config) values
  ('mellow_shopstop', 'MELLOW SHOP STOP', 'scrape', '{}'::jsonb),
  ('mobimaru', 'Mobimaru', 'scrape', '{}'::jsonb),
  ('kitchencar_madoguchi', 'キッチンカーの窓口', 'scrape', '{}'::jsonb),
  ('aeon_mall', 'イオンモール', 'scrape', '{}'::jsonb),
  ('outlet_mall', 'アウトレットモール', 'scrape', '{}'::jsonb),
  ('mie_tourism', '三重県 観光協会', 'scrape', '{}'::jsonb),
  ('mie_news', '伊勢新聞・中日三重', 'scrape', '{}'::jsonb),
  ('mie_fm', '三重FM', 'scrape', '{}'::jsonb),
  ('ja_mie', 'JA三重', 'scrape', '{}'::jsonb),
  ('threads', 'Threads', 'scrape', '{}'::jsonb)
on conflict (id) do update set name = excluded.name;

update public.monitor_sources set source_type = 'scrape', name = 'Facebook'
  where id = 'facebook';
