-- Health Tracker schema
-- 在 Supabase 專案的 SQL Editor 貼上整份執行即可。

-- ── 體重 ────────────────────────────────────────────────
create table if not exists public.weights (
  id          bigint generated always as identity primary key,
  measured_on date        not null unique,          -- 一天一筆
  weight_kg   numeric(5,2) not null check (weight_kg > 0 and weight_kg < 500),
  body_fat    numeric(4,1) check (body_fat >= 0 and body_fat < 100),
  note        text,
  created_at  timestamptz not null default now()
);

-- ── 晨跑 ────────────────────────────────────────────────
create table if not exists public.runs (
  id          bigint generated always as identity primary key,
  ran_on      date        not null unique,          -- 一天一筆
  distance_km numeric(5,2) not null check (distance_km >= 0),
  duration_min numeric(5,1) check (duration_min >= 0),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists weights_measured_on_idx on public.weights (measured_on desc);
create index if not exists runs_ran_on_idx on public.runs (ran_on desc);

-- ── RLS：單人使用，anon key 直接讀寫 ────────────────────
-- 注意：任何拿到 anon key 的人都能讀寫這兩張表。
-- 之後要加 Supabase Auth 時，把 to anon 改成 to authenticated，
-- 並在兩張表加 user_id uuid default auth.uid()，policy 條件改 user_id = auth.uid()。
alter table public.weights enable row level security;
alter table public.runs    enable row level security;

drop policy if exists "anon full access on weights" on public.weights;
create policy "anon full access on weights"
  on public.weights for all to anon
  using (true) with check (true);

drop policy if exists "anon full access on runs" on public.runs;
create policy "anon full access on runs"
  on public.runs for all to anon
  using (true) with check (true);
