-- Oversight — Supabase schema.
-- Run once in the Supabase SQL editor after creating the project.
-- Auth (users) is provided by Supabase Auth; these are the app tables.

-- Saved sites a user monitors ------------------------------------------------
create table if not exists public.sites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  url         text not null,
  created_at  timestamptz not null default now()
);
create index if not exists sites_user_idx on public.sites(user_id);

-- Every scan (anonymous scans have null user_id) ------------------------------
create table if not exists public.scans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  url         text not null,
  overall     int,
  grade       text,
  agents_json jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists scans_user_idx on public.scans(user_id, created_at desc);

-- Row Level Security ---------------------------------------------------------
-- Server endpoints use the service-role key (bypasses RLS) and scope by user_id.
-- These policies protect against any direct client access with the anon key.
alter table public.sites enable row level security;
alter table public.scans enable row level security;

drop policy if exists "sites owner" on public.sites;
create policy "sites owner" on public.sites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scans owner read" on public.scans;
create policy "scans owner read" on public.scans
  for select using (auth.uid() = user_id);
