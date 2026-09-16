-- Health Tracker schema
-- 在 Supabase 專案的 SQL Editor 貼上整份執行即可。
--
-- 這個專案可能跟其他 App 共用同一個 Supabase 專案（免費方案只給兩個），
-- 所以所有東西都放在自己的 health schema，不碰 public，表名也不會跟別人撞。
--
-- ⚠️ 執行完還要做一步：Project Settings → API → Data API →
--    「Exposed schemas」把 health 加進去，否則前端一律 404（PGRST106）。

create schema if not exists health;

-- ── 體重 ────────────────────────────────────────────────
create table if not exists health.weights (
  id          bigint generated always as identity primary key,
  measured_on date        not null unique,          -- 一天一筆
  weight_kg   numeric(5,2) not null check (weight_kg > 0 and weight_kg < 500),
  body_fat    numeric(4,1) check (body_fat >= 0 and body_fat < 100),
  note        text,
  created_at  timestamptz not null default now()
);

-- ── 晨跑 ────────────────────────────────────────────────
create table if not exists health.runs (
  id          bigint generated always as identity primary key,
  ran_on      date        not null unique,          -- 一天一筆
  distance_km numeric(5,2) not null check (distance_km >= 0),
  duration_min numeric(5,1) check (duration_min >= 0),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists weights_measured_on_idx on health.weights (measured_on desc);
create index if not exists runs_ran_on_idx on health.runs (ran_on desc);

-- ── 讓 PostgREST 的 anon 角色進得來 ──────────────────────
grant usage on schema health to anon, authenticated;
grant all on all tables in schema health to anon, authenticated;
grant all on all sequences in schema health to anon, authenticated;
alter default privileges in schema health
  grant all on tables to anon, authenticated;
alter default privileges in schema health
  grant all on sequences to anon, authenticated;

-- ── RLS：單人使用，anon key 直接讀寫 ────────────────────
-- 注意：任何拿到 anon key 的人都能讀寫這兩張表（同專案的其他 App 也共用這把 key）。
-- 之後要加 Supabase Auth 時，把 to anon 改成 to authenticated，
-- 並在兩張表加 user_id uuid default auth.uid()，policy 條件改 user_id = auth.uid()。
alter table health.weights enable row level security;
alter table health.runs    enable row level security;

drop policy if exists "anon full access on weights" on health.weights;
create policy "anon full access on weights"
  on health.weights for all to anon
  using (true) with check (true);

drop policy if exists "anon full access on runs" on health.runs;
create policy "anon full access on runs"
  on health.runs for all to anon
  using (true) with check (true);
