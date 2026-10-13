-- =====================================================================
-- Update 13.10.2026: Zahlen in der Suche und Korrektur III Freunde.
-- Im Supabase SQL Editor ausführen. Kann gefahrlos mehrfach laufen.
-- =====================================================================

set statement_timeout = 0;

-- ---------------------------------------------------------------------
-- 1. Zahlen als Wort: „3", „III" und „drei" finden sich gegenseitig.
--    Im Suchtext steht hinter jeder Ziffer 1–12 bzw. römischen Zahl das Zahlwort
--    („iii freunde" → „iii drei freunde"). Ziffern in der Suchanfrage werden zum Wort.
-- ---------------------------------------------------------------------
create or replace function public.num_words(t text) returns text
language plpgsql immutable set search_path = ''
as $$
declare
  k text[] := array['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
                    'ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'xi', 'xii'];
  v text[] := array['eins', 'zwei', 'drei', 'vier', 'funf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwolf',
                    'zwei', 'drei', 'vier', 'sechs', 'sieben', 'acht', 'neun', 'elf', 'zwolf'];
begin
  for i in 1 .. array_length(k, 1) loop
    t := regexp_replace(t, '\m' || k[i] || '\M', k[i] || ' ' || v[i], 'g');
  end loop;
  return t;
end $$;

-- Suchtext-Trigger mit Zahlwörtern
create or replace function public.wines_search_trigger() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.search_text := public.num_words(public.norm(concat_ws(' ', new.name, new.winery, new.region, new.country,
    (select string_agg(g.name || ' ' || array_to_string(g.synonyms, ' '), ' ')
       from public.wine_grapes wg join public.grapes g on g.id = wg.grape_id
      where wg.wine_id = new.id))));
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Suche: Ziffern 1–12 in der Anfrage werden zum Zahlwort („3 freunde" → „drei freunde"),
--    der Weinname wird für die Gewichtung genauso ergänzt. Sonst unverändert gegenüber 07.
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
begin
  toks := array(select coalesce(v[array_position(k, t)], t)
                from unnest(regexp_split_to_array(phrase, ' ')) t where t <> '');
  if coalesce(array_length(toks, 1), 0) = 0 then
    return;
  end if;
  phrase := array_to_string(toks, ' ');
  -- Seltenstes Suchwort für die Vorauswahl über den Index
  foreach tok in array toks loop
    select count(*) into n from (
      select 1 from public.wines w where w.search_text like '%' || tok || '%' limit 20000) s;
    if n > 0 and (best_n is null or n < best_n) then
      best_n := n;
      lead := tok;
    end if;
  end loop;
  if lead is null then
    select x into lead from unnest(toks) x order by length(x) desc limit 1;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.3', true);
  return query
  with exact as (
    select w.id from public.wines w
    where w.merged_into is null and w.search_text like '%' || lead || '%'
    limit 20000
  ), fuzzy as (
    select w.id from public.wines w
    where w.merged_into is null and lead operator(extensions.<%) w.search_text
    limit 3000
  ), cand as (
    select w.id, w.name, w.winery, w.region, w.type, w.label_path, w.search_text,
           public.num_words(public.norm(w.name)) as nname
    from public.wines w
    where w.id in (select e.id from exact e union select f.id from fuzzy f)
  ), matched as (
    select c.*,
           not exists (select 1 from unnest(toks) x where strpos(c.search_text, x) = 0) as exact_all
    from cand c
    where not exists (
        select 1 from unnest(toks) x
        where not (strpos(c.search_text, x) > 0 or x operator(extensions.<%) c.search_text))
  ), scored as (
    -- Punkte je Suchwort: ganzes Wort im Namen 4, Wortanfang im Namen 3, Wortanfang sonst 2,
    -- irgendwo enthalten 1, sonst Ähnlichkeit; plus 3, wenn die ganze Wortfolge vorkommt
    select m.*,
           (case when strpos(m.search_text, phrase) > 0 then 3 else 0 end)
           + (select sum(case
                           when m.nname ~ ('\m' || x || '\M') then 4
                           when m.nname ~ ('\m' || x) then 3
                           when m.search_text ~ ('\m' || x) then 2
                           when strpos(m.search_text, x) > 0 then 1
                           else 2 * extensions.word_similarity(x, m.nname)
                         end) from unnest(toks) x) as score
    from matched m
    where m.exact_all or not exists (select 1 from matched m2 where m2.exact_all)
  ), ranked as (
    select s.*, max(s.score) over () as top_score from scored s
  )
  select r.id, r.name, r.winery, r.region,
    (select g.name from public.wine_grapes wg join public.grapes g on g.id = wg.grape_id
      where wg.wine_id = r.id order by wg.position limit 1),
    (select round(avg(rt.score)) from public.ratings rt where rt.wine_id = r.id and rt.user_id = auth.uid()),
    r.type, r.label_path,
    (r.exact_all and r.score >= r.top_score - 0.001)
  from ranked r
  order by r.score desc,
           exists (select 1 from public.ratings rt where rt.wine_id = r.id and rt.user_id = auth.uid()) desc,
           length(r.name), r.name
  limit lim;
end $$;

grant execute on function public.search_wines(text, int) to authenticated;

-- ---------------------------------------------------------------------
-- 3. III Freunde: Die Linie heißt „DREI FREUNDE", nicht „ELF FREUNDE".
--    Bewertungen, Fotos und Merkliste bleiben erhalten (gleiche Wein-ID).
-- ---------------------------------------------------------------------
update public.wines w
set name = regexp_replace(regexp_replace(w.name, 'ELF FREUNDE', 'DREI FREUNDE', 'g'), '\m[Ee]lf ([Ff])reunde', 'Drei \1reunde', 'g'),
    external_id = case
      when w.external_id like 'iii-freunde/%' and not exists (
        select 1 from public.wines w2
        where w2.source = w.source and w2.external_id = replace(w.external_id, 'ELF FREUNDE', 'DREI FREUNDE'))
      then replace(w.external_id, 'ELF FREUNDE', 'DREI FREUNDE')
      else w.external_id end
where w.name ~* '\melf freunde';

-- ---------------------------------------------------------------------
-- 4. Suchtext neu berechnen für alle Weine mit Zahl (ca. 1.200 Weine)
-- ---------------------------------------------------------------------
update public.wines set name = name
where search_text ~ '\m([1-9]|1[0-2]|ii|iii|iv|vi|vii|viii|ix|xi|xii)\M';

select name, search_text from public.wines where winery = 'III Freunde' order by name;
