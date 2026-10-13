-- =====================================================================
-- Update 5, Teil B: einheitliche Weinnamen und Dubletten.
-- Im Supabase SQL Editor ausführen, NACH 10a_katalog_daten.sql. Kann gefahrlos mehrfach laufen.
--
-- Namensregel: Name = Name des Weins vom Etikett, ohne Weingut und ohne Jahrgang.
--              Weingut, Rebsorte, Region und Jahrgang stehen in ihren eigenen Feldern.
-- =====================================================================

set statement_timeout = 0;

-- ---------------------------------------------------------------------
-- 1. Vergleichsschlüssel: sortierte Wörter ohne Füllwörter (Reihenfolge und „del/dei" egal)
--    „Lugana - I Frati" + „Ca del Frati" = „I Frati Lugana" + „Cà dei Frati" = „ca frati i lugana"
--    Gleiche Liste wie STOP in tools/naming.mjs und src/lib/naming.ts.
-- ---------------------------------------------------------------------
create or replace function public.token_key(t text) returns text
language sql stable set search_path = ''
as $$
  select coalesce(string_agg(distinct x, ' ' order by x), '')
  from unnest(regexp_split_to_array(trim(regexp_replace(public.norm(t), '[^a-z0-9]+', ' ', 'g')), ' ')) x
  where x <> '' and not (x = any (array[
    'de', 'del', 'dei', 'della', 'delle', 'di', 'da', 'du', 'des', 'la', 'le', 'les', 'il', 'lo', 'el', 'los', 'las',
    'the', 'and', 'et', 'und', 'y', 'e',
    'doc', 'docg', 'aoc', 'aop', 'igp', 'igt', 'dop', 'do', 'doca', 'qba', 'vdp', 'ac',
    'vin', 'vino', 'vinho', 'wine', 'wein', 'rotwein', 'weisswein', 'rosewein', 'wijn']))
$$;

-- Weingut-Schlüssel: zusätzlich ohne Gattungswörter wie Domaine, Weingut, Cà
create or replace function public.winery_key(t text) returns text
language sql stable set search_path = ''
as $$
  select coalesce(string_agg(x, ' ' order by x), '')
  from unnest(string_to_array(public.token_key(t), ' ')) x
  where x <> '' and not (x = any (array[
    'ca', 'domaine', 'chateau', 'weingut', 'bodega', 'bodegas', 'cantina', 'cantine', 'tenuta', 'azienda', 'agricola',
    'cave', 'caves', 'winery', 'estate', 'vineyards', 'wines', 'weinkellerei', 'winzer', 'winzergenossenschaft',
    'cooperative', 'maison', 'quinta', 'casa', 'fattoria', 'podere', 'castello', 'clos']))
$$;

-- Wörter aus k ohne die Wörter aus w
create or replace function public.key_minus(k text, w text) returns text
language sql immutable set search_path = ''
as $$
  select coalesce(string_agg(x, ' ' order by x), '')
  from unnest(string_to_array(coalesce(k, ''), ' ')) x
  where x <> '' and not (x = any (string_to_array(coalesce(w, ''), ' ')))
$$;

-- Anteil gemeinsamer Wörter (Dice), 0–1
create or replace function public.word_dice(a text, b text) returns real
language sql immutable set search_path = ''
as $$
  select case when coalesce(a, '') = '' or coalesce(b, '') = '' then 0::real
    else (2.0 * (select count(*) from (select unnest(string_to_array(a, ' ')) intersect select unnest(string_to_array(b, ' '))) x)
          / (cardinality(string_to_array(a, ' ')) + cardinality(string_to_array(b, ' '))))::real end
$$;

-- Ähnlichkeit zweier Weine, 0–1: Weinname (ohne Weingut-Wörter) zählt 70 %, Weingut 30 %.
-- Gleicher Name in anderer Wortfolge = 1. Anderer Wein vom selben Weingut (Rosso vs. Brunello) bleibt unter 0,8.
create or replace function public.wine_similarity(a_name text, a_winery text, b_name text, b_winery text) returns real
language plpgsql stable set search_path = ''
as $$
declare
  wt text := public.token_key(concat_ws(' ', a_winery, b_winery));
  na text := public.key_minus(public.token_key(a_name), wt);
  nb text := public.key_minus(public.token_key(b_name), wt);
  wa text := public.winery_key(a_winery);
  wb text := public.winery_key(b_winery);
  name_sim real;
  win_sim real;
begin
  name_sim := case when na = nb then 1
                   else greatest(public.word_dice(na, nb), 0.8 * extensions.similarity(na, nb)) end;
  win_sim := case when wa = '' or wb = '' then 0.5
                  else greatest(public.word_dice(wa, wb), extensions.similarity(wa, wb)) end;
  return 0.7 * name_sim + 0.3 * win_sim;
end $$;

-- Ähnliche Weine (IDs mit Ähnlichkeit 0–1), Vorauswahl über den Suchindex mit dem seltensten Wort
create or replace function public.similar_wine_ids(p_name text, p_winery text, p_exclude bigint default null, p_min real default 0.45)
returns table (id bigint, score real)
language plpgsql set search_path = ''
as $$
declare
  k text := public.token_key(concat_ws(' ', p_name, p_winery));
  lead text;
  best_n int := null;
  n int;
  tok text;
begin
  if length(k) < 3 then
    return;
  end if;
  foreach tok in array string_to_array(k, ' ') loop
    continue when length(tok) < 3;
    select count(*) into n from (select 1 from public.wines w where w.search_text like '%' || tok || '%' limit 20000) s;
    if n > 0 and (best_n is null or n < best_n) then
      best_n := n;
      lead := tok;
    end if;
  end loop;
  if lead is null then
    select x into lead from unnest(string_to_array(k, ' ')) x order by length(x) desc limit 1;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);
  return query
  with cand as (
    (select w.id from public.wines w where w.merged_into is null and w.search_text like '%' || lead || '%' limit 20000)
    union
    (select w.id from public.wines w where w.merged_into is null and lead operator(extensions.<%) w.search_text limit 2000)
  ), rough as (
    -- grobe Vorauswahl, danach genauer Vergleich
    select w.id, w.name, w.winery from cand c join public.wines w on w.id = c.id
    where w.id is distinct from p_exclude
      and extensions.similarity(public.token_key(concat_ws(' ', w.name, w.winery)), k) >= 0.25
  ), scored as (
    select r.id, public.wine_similarity(p_name, p_winery, r.name, r.winery) as s from rough r
  )
  select s.id, s.s from scored s where s.s >= p_min order by s.s desc, s.id limit 5;
end $$;

-- Ähnliche Weine beim Neuanlegen: jetzt unabhängig von Wortreihenfolge und Füllwörtern
create or replace function public.similar_wines(p_name text, p_winery text)
returns table (id bigint, name text, winery text, region text, main_grape text, my_avg numeric)
language sql set search_path = ''
as $$
  select w.id, w.name, w.winery, w.region,
    (select g.name from public.wine_grapes wg join public.grapes g on g.id = wg.grape_id
      where wg.wine_id = w.id order by wg.position limit 1),
    null::numeric
  from public.similar_wine_ids(p_name, p_winery, null, 0.45) s
  join public.wines w on w.id = s.id
  order by s.score desc
  limit 3
$$;

-- ---------------------------------------------------------------------
-- 2. Zusammenführen: alles zieht zum Zielwein um (Bewertungen, Merkliste, Weinabende,
--    Empfehlungen, Etikett, Rebsorten, Geschmack). Der doppelte Eintrag verschwindet aus der Suche.
-- ---------------------------------------------------------------------
create or replace function public.merge_wine_into(p_from bigint, p_into bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_from = p_into or p_from is null or p_into is null then
    return;
  end if;
  update public.ratings set wine_id = p_into where wine_id = p_from;
  insert into public.saved_wines (user_id, wine_id, created_at)
    select s.user_id, p_into, s.created_at from public.saved_wines s where s.wine_id = p_from
    on conflict do nothing;
  delete from public.saved_wines where wine_id = p_from;
  insert into public.tasting_wines (tasting_id, wine_id, position)
    select t.tasting_id, p_into, t.position from public.tasting_wines t where t.wine_id = p_from
    on conflict do nothing;
  delete from public.tasting_wines where wine_id = p_from;
  update public.recommendations set wine_id = p_into where wine_id = p_from;
  update public.wines t set
      label_path = coalesce(t.label_path, f.label_path),
      body = coalesce(t.body, f.body),
      acidity = coalesce(t.acidity, f.acidity),
      type = coalesce(t.type, f.type),
      country = coalesce(t.country, f.country),
      region = coalesce(t.region, f.region)
    from public.wines f where f.id = p_from and t.id = p_into;
  if not exists (select 1 from public.wine_grapes where wine_id = p_into) then
    insert into public.wine_grapes (wine_id, grape_id, position)
      select p_into, g.grape_id, g.position from public.wine_grapes g where g.wine_id = p_from;
  end if;
  update public.wines set merged_into = p_into where merged_into = p_from;
  update public.wines set merged_into = p_into where id = p_from;
end $$;
revoke execute on function public.merge_wine_into(bigint, bigint) from public, anon, authenticated;

-- Admin-Funktion aus 01 nutzt jetzt die vollständige Zusammenführung
create or replace function public.merge_wines(p_from bigint, p_into bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Nur für Admins';
  end if;
  perform public.merge_wine_into(p_from, p_into);
  delete from public.duplicate_dismissed where wine_a in (p_from, p_into) or wine_b in (p_from, p_into);
end $$;

-- ---------------------------------------------------------------------
-- 3. Dubletten prüfen (Admin, in der App unter „Ich" → „Dubletten prüfen")
-- ---------------------------------------------------------------------
create table if not exists public.duplicate_dismissed (
  wine_a bigint not null references public.wines (id) on delete cascade,
  wine_b bigint not null references public.wines (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wine_a, wine_b)
);
alter table public.duplicate_dismissed enable row level security;
drop policy if exists "Dubletten Admin" on public.duplicate_dismissed;
create policy "Dubletten Admin" on public.duplicate_dismissed for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, delete on public.duplicate_dismissed to authenticated;

-- Mögliche Dubletten unter den Weinen, die zählen: selbst angelegte und bewertete Weine
create or replace function public.duplicate_candidates()
returns table (a_id bigint, a_name text, a_winery text, a_source text, a_ratings int,
               b_id bigint, b_name text, b_winery text, b_source text, b_ratings int, score real)
language plpgsql security definer set search_path = ''
as $$
declare
  w record;
  m record;
  seen text[] := '{}';
  pair text;
begin
  if not public.is_admin() then
    raise exception 'Nur für Admins';
  end if;
  for w in
    select x.id, x.name, x.winery, x.type from public.wines x
    where x.merged_into is null
      and (x.source = 'manuell' or exists (select 1 from public.ratings r where r.wine_id = x.id))
  loop
    for m in select s.id, s.score from public.similar_wine_ids(w.name, w.winery, w.id, 0.8) s loop
      pair := least(w.id, m.id) || '-' || greatest(w.id, m.id);
      continue when pair = any (seen);
      seen := seen || pair;
      continue when exists (select 1 from public.duplicate_dismissed d
                            where d.wine_a = least(w.id, m.id) and d.wine_b = greatest(w.id, m.id));
      return query
      select a.id, a.name, a.winery, a.source, (select count(*)::int from public.ratings r where r.wine_id = a.id),
             b.id, b.name, b.winery, b.source, (select count(*)::int from public.ratings r where r.wine_id = b.id),
             m.score
      from public.wines a, public.wines b
      where a.id = w.id and b.id = m.id
        and (a.type is null or b.type is null or a.type = b.type);
    end loop;
  end loop;
end $$;

create or replace function public.dismiss_duplicate(p_a bigint, p_b bigint)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.duplicate_dismissed (wine_a, wine_b)
  select least(p_a, p_b), greatest(p_a, p_b) where public.is_admin()
  on conflict do nothing
$$;

-- ---------------------------------------------------------------------
-- 4. Katalog bereinigen: Open-Food-Facts-Namen nach der Namensregel, Dubletten zusammenführen
--    (Korrekturliste aus 10a; ohne 10a passiert hier nichts)
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  n_ren int := 0;
  n_mer int := 0;
begin
  if to_regclass('staging.off_rename') is null then
    raise notice 'Keine Korrekturliste gefunden (10a nicht ausgeführt) – Schritt übersprungen.';
    return;
  end if;
  update public.wines w set name = x.name, winery = x.winery
  from staging.off_rename x
  where w.source = 'import' and w.external_id = x.external_id and w.name = x.old_name;
  get diagnostics n_ren = row_count;
  for r in
    select f.id as from_id, t.id as into_id
    from staging.off_merge m
    join public.wines f on f.source = 'import' and f.external_id = m.from_ext and f.merged_into is null
    join public.wines t on t.source = 'import' and t.external_id = m.into_ext
  loop
    perform public.merge_wine_into(r.from_id, coalesce((select w2.merged_into from public.wines w2 where w2.id = r.into_id), r.into_id));
    n_mer := n_mer + 1;
  end loop;
  drop table staging.off_rename, staging.off_merge;
  raise notice 'Umbenannt: %, zusammengeführt: %', n_ren, n_mer;
end $$;

select
  (select count(*) from public.wines where merged_into is not null) as zusammengefuehrte_weine,
  (select name || ' | ' || winery from public.wines where source = 'import' and external_id = 'off:8058456385303') as beispiel_lugana,
  (select merged_into is not null from public.wines where source = 'import' and external_id = 'off:8058456385303') as lugana_zusammengefuehrt;
