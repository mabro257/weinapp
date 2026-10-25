-- =====================================================================
-- Update 10: schnellere Katalogsuche.
-- Im Supabase SQL Editor ausführen, NACH 13. Dauert einmalig etwa eine Minute. Kann mehrfach laufen.
--
-- 1. Der für die Gewichtung aufbereitete Weinname wird gespeichert (Spalte name_norm, mit Index),
--    statt ihn bei jeder Suche für tausende Weine neu zu berechnen.
-- 2. Die unscharfe Suche (Tippfehler) läuft nur noch, wenn es keinen exakten Treffer gibt.
-- 3. Kandidaten zuerst über Wortanfänge im Namen, höchstens 3.000 je Quelle.
-- 4. Einzelne Buchstaben werden ignoriert („r" sucht nichts, „ri" schon).
-- Ergebnis und Reihenfolge bleiben wie bisher (beste Treffer oben, eigene Weine bei Gleichstand zuerst).
-- =====================================================================

set statement_timeout = 0;

-- ---------------------------------------------------------------------
-- 1. Gespeicherter Name für die Gewichtung: nur Buchstaben/Ziffern, Zahlwörter ergänzt, mit Leerzeichen
--    an Anfang und Ende („ iii drei freunde "), damit ganze Wörter per LIKE erkennbar sind.
-- ---------------------------------------------------------------------
alter table public.wines add column if not exists name_norm text;

create or replace function public.name_norm(t text) returns text
language sql stable set search_path = ''
as $$ select ' ' || public.num_words(trim(regexp_replace(public.norm(t), '[^a-z0-9]+', ' ', 'g'))) || ' ' $$;

create or replace function public.wines_search_trigger() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.search_text := public.num_words(public.norm(concat_ws(' ', new.name, new.winery, new.region, new.country,
    (select string_agg(g.name || ' ' || array_to_string(g.synonyms, ' '), ' ')
       from public.wine_grapes wg join public.grapes g on g.id = wg.grape_id
      where wg.wine_id = new.id))));
  new.match_key := public.token_key(concat_ws(' ', new.name, new.winery));
  new.name_norm := public.name_norm(new.name);
  return new;
end $$;

update public.wines set name_norm = public.name_norm(name) where name_norm is null;

create index if not exists wines_name_norm_trgm on public.wines using gin (name_norm extensions.gin_trgm_ops);
analyze public.wines;

-- ---------------------------------------------------------------------
-- 2. Suche
-- ---------------------------------------------------------------------
create or replace function public.search_wines(q text, lim int default 20)
returns table (id bigint, name text, winery text, region text, main_grape text, my_avg numeric,
               type text, label_path text, best boolean)
language plpgsql set search_path = ''
as $$
declare
  k text[] := array['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  v text[] := array['eins', 'zwei', 'drei', 'vier', 'funf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwolf'];
  phrase text := trim(regexp_replace(public.norm(q), '[^a-z0-9]+', ' ', 'g'));
  toks text[];
  lead text;
  best_n int := null;
  n int;
  tok text;
  uid uuid := auth.uid();
begin
  -- Ziffern 1–12 als Wort; einzelne Buchstaben zählen nicht
  toks := array(select x from (select coalesce(v[array_position(k, t)], t) as x
                               from unnest(regexp_split_to_array(phrase, ' ')) t where t <> '') s
                where length(s.x) >= 2);
  if coalesce(array_length(toks, 1), 0) = 0 then
    return;
  end if;
  phrase := array_to_string(toks, ' ');

  -- Seltenstes Suchwort für die Vorauswahl (zählt höchstens bis 3.000)
  foreach tok in array toks loop
    select count(*) into n from (select 1 from public.wines w where w.search_text like '%' || tok || '%' limit 3000) s;
    if n > 0 and (best_n is null or n < best_n) then
      best_n := n;
      lead := tok;
    end if;
  end loop;

  -- a) Exakte Suche: alle Suchwörter kommen vor
  if lead is not null then
    return query
    with cand as (
      (select w.id from public.wines w where w.merged_into is null and w.name_norm like '% ' || lead || '%' limit 3000)
      union
      (select w.id from public.wines w where w.merged_into is null and w.search_text like '%' || lead || '%' limit 3000)
      union
      (select r.wine_id from public.ratings r where r.user_id = uid)
    ), hits as (
      select w.id, w.name, w.winery, w.region, w.type, w.label_path, w.search_text, w.name_norm
      from cand c join public.wines w on w.id = c.id
      where w.merged_into is null
        and not exists (select 1 from unnest(toks) x where strpos(w.search_text, x) = 0)
    ), scored as (
      -- Punkte je Suchwort: ganzes Wort im Namen 4, Wortanfang im Namen 3, Wortanfang sonst 2, irgendwo 1;
      -- plus 3, wenn die ganze Wortfolge vorkommt
      select h.*,
             (case when strpos(h.search_text, phrase) > 0 then 3 else 0 end)
             + (select sum(case
                             when h.name_norm like '% ' || x || ' %' then 4
                             when h.name_norm like '% ' || x || '%' then 3
                             when h.search_text like x || '%' or h.search_text like '% ' || x || '%' then 2
                             else 1
                           end) from unnest(toks) x)::real as score,
             exists (select 1 from public.ratings rt where rt.wine_id = h.id and rt.user_id = uid) as mine
      from hits h
    ), ranked as (
      select s.*, max(s.score) over () as top_score,
             row_number() over (order by s.score desc, s.mine desc, length(s.name), s.name) as rn
      from scored s
    )
    select r.id, r.name, r.winery, r.region,
      (select g.name from public.wine_grapes wg join public.grapes g on g.id = wg.grape_id
        where wg.wine_id = r.id order by wg.position limit 1),
      (select round(avg(rt.score)) from public.ratings rt where rt.wine_id = r.id and rt.user_id = uid),
      r.type, r.label_path, r.score >= r.top_score - 0.001
    from ranked r
    where r.rn <= lim
    order by r.rn;
    if found then
      return;
    end if;
  else
    select x into lead from unnest(toks) x order by length(x) desc limit 1;
  end if;

  -- b) Kein exakter Treffer: unscharfe Suche (Tippfehler)
  perform set_config('pg_trgm.word_similarity_threshold', '0.3', true);
  return query
  with cand as (
    select w.id from public.wines w
    where w.merged_into is null and lead operator(extensions.<%) w.search_text
    limit 3000
  ), hits as (
    select w.id, w.name, w.winery, w.region, w.type, w.label_path, w.search_text, w.name_norm
    from cand c join public.wines w on w.id = c.id
    where not exists (
      select 1 from unnest(toks) x
      where not (strpos(w.search_text, x) > 0 or x operator(extensions.<%) w.search_text))
  ), scored as (
    select h.*,
           (select sum(case
                         when h.name_norm like '% ' || x || ' %' then 4
                         when h.name_norm like '% ' || x || '%' then 3
                         when strpos(h.search_text, x) > 0 then 1
                         else 2 * extensions.word_similarity(x, h.name_norm)
                       end) from unnest(toks) x)::real as score,
           exists (select 1 from public.ratings rt where rt.wine_id = h.id and rt.user_id = uid) as mine
    from hits h
  ), ranked as (
    select s.*, row_number() over (order by s.score desc, s.mine desc, length(s.name), s.name) as rn
    from scored s
  )
  select r.id, r.name, r.winery, r.region,
    (select g.name from public.wine_grapes wg join public.grapes g on g.id = wg.grape_id
      where wg.wine_id = r.id order by wg.position limit 1),
    (select round(avg(rt.score)) from public.ratings rt where rt.wine_id = r.id and rt.user_id = uid),
    r.type, r.label_path, false
  from ranked r
  where r.rn <= lim
  order by r.rn;
end $$;

grant execute on function public.search_wines(text, int) to authenticated;

select count(*) filter (where name_norm is null) as ohne_name_norm, count(*) as weine from public.wines;
