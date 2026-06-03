-- Stripe サブスクリプション（Webhook / API が service_role で更新）

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'standard', 'premium')),
  status text not null default 'none'
    check (status in ('none', 'active', 'trialing', 'past_due', 'canceled', 'unpaid')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 既存 profiles の課金データを subscriptions へ移行（あれば）
insert into public.subscriptions (user_id, plan, status, stripe_customer_id, stripe_subscription_id)
select
  p.user_id,
  coalesce(p.subscription_plan, 'free'),
  coalesce(p.subscription_status, 'none'),
  p.stripe_customer_id,
  p.stripe_subscription_id
from public.profiles p
where p.user_id is not null
on conflict (user_id) do update set
  plan = excluded.plan,
  status = excluded.status,
  stripe_customer_id = coalesce(excluded.stripe_customer_id, public.subscriptions.stripe_customer_id),
  stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.subscriptions.stripe_subscription_id),
  updated_at = now();
