-- C-04 閉店チェック
-- 独自属性を登録したカフェについて、週1回の OSM 取り込み後に次を確認する(scripts/osm/check-closed.ts)。
--   * OSM からカフェが消えた(閉店・移転・別の施設になった可能性)
--   * OSM の店名が、確認したときの店名から変わった(別の店になった可能性)
--   * 確認日から180日以上たった(再確認が必要)
-- OSM のテーブルは書き換えず、独自データ(cafe_attributes)側に確認時の店名を持つ。

alter table cafe_attributes add column if not exists name_at_check text; -- 確認したときの店名(登録時に入れる)

create or replace function cafe_attribute_checks()
returns table (osm_id text, name_at_check text, current_name text, checked_at date, in_osm boolean)
language sql stable as $$
  select a.osm_id, a.name_at_check, c.name, a.checked_at, c.osm_id is not null
  from cafe_attributes a
  left join osm_cafes c on c.osm_id = a.osm_id
  where not a.closed;
$$;
