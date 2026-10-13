-- =====================================================================
-- Update 9: Dubletten-Prüfung und „Gibt es schon?" schneller und genauer.
-- Im Supabase SQL Editor ausführen, NACH 12. Dauert einmalig etwa eine Minute. Kann mehrfach laufen.
--
-- Vorher dauerte die Prüfung mit dem vollen Katalog rund 15 Sekunden und wurde von Supabase
-- (Zeitlimit 8 Sekunden) abgebrochen. Jetzt hat jeder Wein einen gespeicherten Vergleichsschlüssel
-- mit eigenem Suchindex.
-- =====================================================================

set statement_timeout = 0;

-- ---------------------------------------------------------------------
-- 1. Vergleichsschlüssel je Wein (sortierte Wörter aus Name und Weingut, siehe token_key)
-- ---------------------------------------------------------------------
alter table public.wines add column if not exists match_key text;

create or replace function public.wines_search_trigger() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.search_text := public.num_words(public.norm(concat_ws(' ', new.name, new.winery, new.region, new.country,
    (select string_agg(g.name || ' ' || array_to_string(g.synonyms, ' '), ' ')
       from public.wine_grapes wg join public.grapes g on g.id = wg.grape_id
      where wg.wine_id = new.id))));
  new.match_key := public.token_key(concat_ws(' ', new.name, new.winery));
  return new;
end $$;

update public.wines set match_key = public.token_key(concat_ws(' ', name, winery))
where match_key is distinct from public.token_key(concat_ws(' ', name, winery));

create index if not exists wines_match_trgm on public.wines using gin (match_key extensions.gin_trgm_ops);
analyze public.wines;

-- ---------------------------------------------------------------------
-- 2. Weingut-Vergleich ohne Einzelbuchstaben („J. Riehl" ≠ „J. Bäumer")
-- ---------------------------------------------------------------------
create or replace function public.winery_key(t text) returns text
language sql stable set search_path = ''
as $$
  select coalesce(string_agg(x, ' ' order by x), '')
  from unnest(string_to_array(public.token_key(t), ' ')) x
  where length(x) > 1 and not (x = any (array[
    'ca', 'domaine', 'chateau', 'weingut', 'bodega', 'bodegas', 'cantina', 'cantine', 'tenuta', 'azienda', 'agricola',
    'cave', 'caves', 'winery', 'estate', 'vineyards', 'wines', 'weinkellerei', 'winzer', 'winzergenossenschaft',
    'cooperative', 'maison', 'quinta', 'casa', 'fattoria', 'podere', 'castello', 'clos']))
$$;

-- Ähnlichkeit 0–1: Name 70 %, Weingut 30 %. Passen beide Weingüter klar nicht zusammen, höchstens 0,6.
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
  s real;
begin
  name_sim := case when na = nb then 1
                   else greatest(public.word_dice(na, nb), 0.8 * extensions.similarity(na, nb)) end;
  win_sim := case when wa = '' or wb = '' then 0.5
                  else greatest(public.word_dice(wa, wb), extensions.similarity(wa, wb)) end;
  s := 0.7 * name_sim + 0.3 * win_sim;
  if wa <> '' and wb <> '' and win_sim < 0.6 then
    s := least(s, 0.6);
  end if;
  return s;
end $$;

-- ---------------------------------------------------------------------
-- 3. Kandidaten über den Index statt über bis zu 20.000 Treffer
-- ---------------------------------------------------------------------
create or replace function public.similar_wine_ids(p_name text, p_winery text, p_exclude bigint default null, p_min real default 0.45)
returns table (id bigint, score real)
language plpgsql set search_path = ''
as $$
declare
  k text := public.token_key(concat_ws(' ', p_name, p_winery));
begin
  if length(k) < 3 then
    return;
  end if;
  -- Vorfilter: für die Dubletten-Prüfung (p_min hoch) streng, für Vorschläge beim Anlegen großzügig
  perform set_config('pg_trgm.similarity_threshold', case when p_min >= 0.9 then '0.6' else '0.3' end, true);
  return query
  with cand as (
    select w.id, w.name, w.winery
    from public.wines w
    where w.merged_into is null and w.id is distinct from p_exclude
      and w.match_key operator(extensions.%) k
    order by extensions.similarity(w.match_key, k) desc
    limit 60
  ), scored as (
    select c.id, public.wine_similarity(p_name, p_winery, c.name, c.winery) as s from cand c
  )
  select s.id, s.s from scored s where s.s >= p_min order by s.s desc, s.id limit 5;
end $$;

-- Dublette erst bei praktisch gleichem Namen und passendem Weingut (vorher 0,8)
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
    for m in select s.id, s.score from public.similar_wine_ids(w.name, w.winery, w.id, 0.92) s loop
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

select count(*) filter (where match_key is null) as ohne_schluessel, count(*) as weine from public.wines;
