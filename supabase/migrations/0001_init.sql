-- ぴためし 初期スキーマ(Supabase / PostgreSQL + PostGIS)
-- 適用: Supabase のダッシュボード > SQL Editor に貼り付けて実行、または `supabase db push`
--
-- 大事なルール(要件定義書「外部連携と制約 > OpenStreetMap」):
--   * osm_cafes / osm_stations は OSM のデータをそのまま入れる。手で書き換えない。
--   * 独自データ(cafe_attributes)は別テーブルに持ち、osm_id で参照するだけにする。
--   * ホットペッパーの店舗データはここに保存しない(API規約:都度取得、キャッシュは24時間以内)。

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- OSM データ(週1回、scripts/osm/import.ts が入れ直す)
-- ---------------------------------------------------------------------------
create table if not exists osm_cafes (
  osm_id          text primary key,           -- "node/123" "way/456"
  name            text not null,
  geom            geography(point, 4326) not null,
  opening_hours   text,
  internet_access text,
  smoking         text,
  brand           text,
  website         text,
  imported_at     timestamptz not null default now()
);
create index if not exists osm_cafes_geom_idx on osm_cafes using gist (geom);

create table if not exists osm_stations (
  osm_id      text primary key,
  name        text not null,
  geom        geography(point, 4326) not null,
  imported_at timestamptz not null default now()
);
create index if not exists osm_stations_geom_idx on osm_stations using gist (geom);

-- ---------------------------------------------------------------------------
-- 独自データ(運営者が確認して登録。OSMとは独立)
-- ---------------------------------------------------------------------------
create table if not exists cafe_attributes (
  osm_id         text primary key,             -- osm_cafes.osm_id を参照(外部キーは付けない:OSM側で消えても独自データは残す)
  power          boolean,                      -- 電源
  work_friendly  boolean,                      -- 作業OK
  long_stay      boolean,                      -- 長居しやすい
  solo           boolean,                      -- 一人で入りやすい
  checked_at     date not null,                -- 確認日(180日より古いと「情報が古い可能性」表示)
  source         text,                         -- 情報源(運営者訪問、公式サイト など)
  closed         boolean not null default false, -- 閉店・移転を確認したら true(C-04)
  updated_at     timestamptz not null default now()
);

-- 予約リンクのクリック記録(個人を特定する情報は持たない)
create table if not exists click_logs (
  id          bigint generated always as identity primary key,
  shop_id     text not null,
  from_path   text,
  preset      text,
  clicked_at  timestamptz not null default now()
);
create index if not exists click_logs_clicked_at_idx on click_logs (clicked_at);

-- サーバー(サービスロールキー)からだけ触る。匿名キーからは読めない・書けないようにする。
alter table osm_cafes enable row level security;
alter table osm_stations enable row level security;
alter table cafe_attributes enable row level security;
alter table click_logs enable row level security;

-- ---------------------------------------------------------------------------
-- 関数(src/lib/osm/providers.ts から RPC で呼ぶ)
-- ---------------------------------------------------------------------------
create or replace function nearby_cafes(p_lat double precision, p_lng double precision, p_radius_m integer, p_limit integer default 300)
returns table (osm_id text, name text, lat double precision, lng double precision, opening_hours text, internet_access text, smoking text, brand text, website text)
language sql stable as $$
  select c.osm_id, c.name, st_y(c.geom::geometry), st_x(c.geom::geometry), c.opening_hours, c.internet_access, c.smoking, c.brand, c.website
  from osm_cafes c
  where st_dwithin(c.geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, least(p_radius_m, 5000))
  order by c.geom <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  limit least(p_limit, 500);
$$;

create or replace function cafe_attributes_for(p_osm_ids text[])
returns table (osm_id text, power boolean, work_friendly boolean, long_stay boolean, solo boolean, checked_at date, source text)
language sql stable as $$
  select a.osm_id, a.power, a.work_friendly, a.long_stay, a.solo, a.checked_at, a.source
  from cafe_attributes a
  where a.osm_id = any(p_osm_ids) and not a.closed;
$$;

create or replace function stations_in_bbox(p_south double precision, p_west double precision, p_north double precision, p_east double precision)
returns table (osm_id text, name text, lat double precision, lng double precision)
language sql stable as $$
  select s.osm_id, s.name, st_y(s.geom::geometry), st_x(s.geom::geometry)
  from osm_stations s
  where s.geom::geometry && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
  limit 2000;
$$;

-- 取り込み用:一時テーブルから入れ替える(取り込み中も検索が止まらないように)
create or replace function replace_osm_cafes()
returns void language plpgsql as $$
begin
  delete from osm_cafes where osm_id not in (select osm_id from osm_cafes_staging);
  insert into osm_cafes (osm_id, name, geom, opening_hours, internet_access, smoking, brand, website, imported_at)
    select osm_id, name, geom, opening_hours, internet_access, smoking, brand, website, now() from osm_cafes_staging
  on conflict (osm_id) do update set
    name = excluded.name, geom = excluded.geom, opening_hours = excluded.opening_hours,
    internet_access = excluded.internet_access, smoking = excluded.smoking, brand = excluded.brand,
    website = excluded.website, imported_at = now();
  truncate osm_cafes_staging;
end;
$$;

create or replace function replace_osm_stations()
returns void language plpgsql as $$
begin
  delete from osm_stations where osm_id not in (select osm_id from osm_stations_staging);
  insert into osm_stations (osm_id, name, geom, imported_at)
    select osm_id, name, geom, now() from osm_stations_staging
  on conflict (osm_id) do update set name = excluded.name, geom = excluded.geom, imported_at = now();
  truncate osm_stations_staging;
end;
$$;

create table if not exists osm_cafes_staging (like osm_cafes including defaults);
create table if not exists osm_stations_staging (like osm_stations including defaults);
alter table osm_cafes_staging enable row level security;
alter table osm_stations_staging enable row level security;

-- 取り込みの最初に呼ぶ(前回失敗して残ったデータを消す)
create or replace function begin_osm_import()
returns void language sql as $$
  truncate osm_cafes_staging;
  truncate osm_stations_staging;
$$;
