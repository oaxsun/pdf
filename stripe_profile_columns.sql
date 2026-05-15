-- Tester Pro rule: users with @oaxsun.tech emails are created as Pro automatically.
-- The frontend also treats @oaxsun.tech as Pro as a fallback for existing tester accounts.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  last_password_change_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- Existing projects: add this column if your profiles table already existed.
alter table public.profiles
add column if not exists last_password_change_at timestamptz;

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, plan)
  values (new.id, new.email, case when lower(new.email) like '%@oaxsun.tech' then 'pro' else 'free' end)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();
