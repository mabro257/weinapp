-- =====================================================================
-- Update 6: Zahlen im Dublettenvergleich, III Freunde bereinigt, Weinabend löschen.
-- Im Supabase SQL Editor ausführen, NACH 10b. Kann gefahrlos mehrfach laufen.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Vergleichsschlüssel: Zahlen als Wort („III" = „3" = „drei"), „trocken"/„dry" zählen nicht.
--    Damit gilt „DREI FREUNDE Rosé" vom Weingut „III Freunde" als „Rosé".
--    Gleiche Listen wie in src/lib/naming.ts und tools/naming.mjs.
-- ---------------------------------------------------------------------
create or replace function public.token_key(t text) returns text
language sql stable set search_path = ''
as $$
  select coalesce(string_agg(distinct m, ' ' order by m), '')
  from (
    select case x
      when '1' then 'eins' when '2' then 'zwei' when '3' then 'drei' when '4' then 'vier' when '5' then 'funf'
      when '6' then 'sechs' when '7' then 'sieben' when '8' then 'acht' when '9' then 'neun' when '10' then 'zehn'
      when '11' then 'elf' when '12' then 'zwolf'
      when 'ii' then 'zwei' when 'iii' then 'drei' when 'iv' then 'vier' when 'vi' then 'sechs' when 'vii' then 'sieben'
      when 'viii' then 'acht' when 'ix' then 'neun' when 'xi' then 'elf' when 'xii' then 'zwolf'
      else x end as m
    from unnest(regexp_split_to_array(trim(regexp_replace(public.norm(t), '[^a-z0-9]+', ' ', 'g')), ' ')) x
    where x <> '' and not (x = any (array[
      'de', 'del', 'dei', 'della', 'delle', 'di', 'da', 'du', 'des', 'la', 'le', 'les', 'il', 'lo', 'el', 'los', 'las',
      'the', 'and', 'et', 'und', 'y', 'e',
      'doc', 'docg', 'aoc', 'aop', 'igp', 'igt', 'dop', 'do', 'doca', 'qba', 'vdp', 'ac',
      'vin', 'vino', 'vinho', 'wine', 'wein', 'rotwein', 'weisswein', 'rosewein', 'wijn',
      'trocken', 'dry']))
  ) s
$$;

-- ---------------------------------------------------------------------
-- 2. III Freunde: „DREI FREUNDE Rosé" ist derselbe Wein wie „Rosé" → zusammenführen.
--    Danach das Weingut aus den übrigen Namen nehmen (Namensregel):
--    „DREI FREUNDE Riesling" → „Riesling", „DREI FREUNDE Grauburgunder" → „Grauburgunder".
--    Ob diese beiden dieselben sind wie „Riesling" bzw. „Grauburgunder Trocken" aus dem Katalog,
--    entscheidet der Admin unter „Dubletten prüfen".
-- ---------------------------------------------------------------------
do $$
declare
  f bigint;
  t bigint;
begin
  select id into f from public.wines
  where winery = 'III Freunde' and merged_into is null and public.norm(name) ~ '^(drei|elf|iii) freunde rose$' limit 1;
  select id into t from public.wines
  where winery = 'III Freunde' and merged_into is null and public.norm(name) = 'rose' order by id limit 1;
  if f is not null and t is not null then
    perform public.merge_wine_into(f, t);
    raise notice 'DREI FREUNDE Rosé → Rosé zusammengeführt';
  end if;
end $$;

update public.wines
set name = trim(regexp_replace(name, '^\s*(DREI|Drei|drei|III)\s+(FREUNDE|Freunde|freunde)\s*[-–]?\s*', ''))
where winery = 'III Freunde' and merged_into is null
  and name ~* '^\s*(drei|iii)\s+freunde\s+\S';

-- ---------------------------------------------------------------------
-- 3. Weinabend absagen/löschen (nur Gastgeber).
--    p_delete_ratings = true: alle Bewertungen dieses Abends werden für alle gelöscht.
--    false: die Bewertungen bleiben als normale Bewertungen erhalten (ohne Bezug zum Abend).
-- ---------------------------------------------------------------------
create or replace function public.delete_tasting(p_tasting bigint, p_delete_ratings boolean)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  n int := 0;
begin
  if not exists (select 1 from public.tastings t where t.id = p_tasting and t.host = auth.uid()) then
    raise exception 'Nur der Gastgeber kann den Weinabend löschen';
  end if;
  if p_delete_ratings then
    delete from public.ratings where tasting_id = p_tasting;
    get diagnostics n = row_count;
  end if;
  -- Bewertungen ohne Löschen verlieren über „on delete set null" den Bezug zum Abend
  delete from public.tastings where id = p_tasting;
  return n;
end $$;
grant execute on function public.delete_tasting(bigint, boolean) to authenticated;

select name, external_id, merged_into is not null as zusammengefuehrt
from public.wines where winery = 'III Freunde' order by merged_into nulls first, name;
