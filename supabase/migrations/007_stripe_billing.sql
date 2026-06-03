-- Stripe 課金連携（subscription_plan は Webhook のみ更新）

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'none'
    check (subscription_status in ('none', 'active', 'trialing', 'past_due', 'canceled', 'unpaid'));

create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create or replace function public.profiles_protect_billing()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.subscription_plan is distinct from old.subscription_plan
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.subscription_status is distinct from old.subscription_status
  then
    if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb->>'role' = 'service_role' then
      return new;
    end if;
    new.subscription_plan := old.subscription_plan;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.subscription_status := old.subscription_status;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_billing on public.profiles;
create trigger profiles_protect_billing
  before update on public.profiles
  for each row execute function public.profiles_protect_billing();
