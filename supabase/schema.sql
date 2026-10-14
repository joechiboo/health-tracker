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

-- ── 運動 ────────────────────────────────────────────────
-- 舊版只記晨跑（health.runs），現在改成所有運動項目：
-- 時間（分鐘）是打球、健身、跑步共通的單位，改當必填；距離只有跑步、騎車才有，改成選填。
do $$
begin
  if to_regclass('health.runs') is not null and to_regclass('health.exercises') is null then
    alter table health.runs rename to exercises;
    alter table health.exercises rename column ran_on to done_on;
    alter table health.exercises add column if not exists sport text not null default '跑步';
    alter table health.exercises alter column distance_km drop not null;
    drop index if exists health.runs_ran_on_idx;
  end if;
end $$;

create table if not exists health.exercises (
  id          bigint generated always as identity primary key,
  done_on     date        not null,                 -- 一天可以多筆（早上跑、下午加練）
  sport       text        not null default '跑步',  -- 跑步／打球／健身…
  duration_min numeric(5,1) check (duration_min >= 0),
  distance_km numeric(5,2) check (distance_km >= 0), -- 選填，跑步、騎車才有
  note        text,
  created_at  timestamptz not null default now()
);

-- 舊版運動一天限一筆，拿掉 done_on 的唯一鍵（rename 過來的表約束名可能還叫 runs_ran_on_key）
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
    where con.conrelid = 'health.exercises'::regclass and con.contype = 'u'
      and a.attname = 'done_on' and array_length(con.conkey, 1) = 1
  loop
    execute format('alter table health.exercises drop constraint %I', c.conname);
  end loop;
end $$;

create index if not exists weights_measured_on_idx on health.weights (measured_on desc);
create index if not exists exercises_done_on_idx on health.exercises (done_on desc);

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
alter table health.exercises enable row level security;

drop policy if exists "anon full access on weights" on health.weights;
create policy "anon full access on weights"
  on health.weights for all to anon
  using (true) with check (true);

drop policy if exists "anon full access on runs" on health.exercises;
drop policy if exists "anon full access on exercises" on health.exercises;
create policy "anon full access on exercises"
  on health.exercises for all to anon
  using (true) with check (true);
