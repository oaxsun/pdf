-- Ejecuta esto en Supabase SQL Editor.
-- Es necesario para que el pago de Stripe cambie automáticamente el estado a PRO.

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_product_id text,
  add column if not exists subscription_status text,
  add column if not exists subscription_current_period_start timestamptz,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean default false,
  add column if not exists updated_at timestamptz default now();

create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id);

create index if not exists profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id);
