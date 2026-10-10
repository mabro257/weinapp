-- =====================================================================
-- Schnellere Suche für den großen Katalog (100.000 Weine).
-- Im Supabase SQL Editor ausführen. Kann gefahrlos mehrfach laufen.
-- =====================================================================

-- Katalogsuche: Vorauswahl über den Suchindex (längstes Suchwort),
-- dann müssen alle Suchwörter passen (exakt oder ähnlich).
create or replace function public.search_wines(q text, lim int default 20)
returns table (id bigint, name text, winery text, region text, main_grape text, my_avg numeric)
language plpgsql set search_path = ''
as $$
declare
  -- Suchwörter: normalisiert, nur Buchstaben und Ziffern
  phrase text := trim(regexp_replace(public.norm(q), '[^a-z0-9]+', ' ', 'g'));
  toks text[] := array(select t from unnest(regexp_split_to_array(phrase, ' ')) t where t <> '');
  lead text;
begin
  if coalesce(array_length(toks, 1), 0) = 0 then
    return;
  end if;
  -- Das längste Suchwort grenzt über den Index am besten ein
  select t into lead from unnest(toks) t order by length(t) desc limit 1;
  perform set_config('pg_trgm.word_similarity_threshold', '0.3', true);
  return query
  with exact as (
    select w.id from public.wines w
    where w.merged_into is null and w.search_text like '%' || lead || '%'
    limit 5000
  ), fuzzy as (
    select w.id from public.wines w
    where w.merged_into is null and lead operator(extensions.<%) w.search_text
    limit 3000
  ), cand as (
    select w.id, w.name, w.winery, w.region, w.search_text, public.norm(w.name) as nname
    from public.wines w
    where w.id in (select e.id from exact e union select f.id from fuzzy f)
  )
  select c.id, c.name, c.winery, c.region,
    (select g.name from public.wine_grapes wg join public.grapes g on g.id = wg.grape_id
      where wg.wine_id = c.id order by wg.position limit 1),
    (select round(avg(r.score)) from public.ratings r where r.wine_id = c.id and r.user_id = auth.uid())
  from cand c
  where not exists (
      select 1 from unnest(toks) t
      where not (strpos(c.search_text, t) > 0 or t operator(extensions.<%) c.search_text))
  -- Reihenfolge: selbst bewertete Weine, dann Punkte je Suchwort
  -- (Wortanfang im Namen 3, Wortanfang sonst 2, irgendwo enthalten 1, sonst Ähnlichkeit),
  -- plus 3 Punkte, wenn die ganze Wortfolge vorkommt
  order by exists (select 1 from public.ratings r where r.wine_id = c.id and r.user_id = auth.uid()) desc,
           (case when strpos(c.search_text, phrase) > 0 then 3 else 0 end)
           + (select sum(case
                           when c.nname ~ ('\m' || t) then 3
                           when c.search_text ~ ('\m' || t) then 2
                           when strpos(c.search_text, t) > 0 then 1
                           else 2 * extensions.word_similarity(t, c.nname)
                         end) from unnest(toks) t) desc,
           length(c.name), c.name
  limit lim;
end $$;

-- Ähnliche Weine beim Neuanlegen (gegen Dubletten), ebenfalls über den Suchindex
create or replace function public.similar_wines(p_name text, p_winery text)
returns table (id bigint, name text, winery text, region text, main_grape text, my_avg numeric)
language plpgsql set search_path = ''
as $$
declare
  n text := public.norm(p_name);
  full_q text := public.norm(concat_ws(' ', p_name, p_winery));
begin
  if length(n) < 3 then
    return;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);
  return query
  select w.id, w.name, w.winery, w.region,
    (select g.name from public.wine_grapes wg join public.grapes g on g.id = wg.grape_id
      where wg.wine_id = w.id order by wg.position limit 1),
    null::numeric
  from public.wines w
  where w.merged_into is null
    and n operator(extensions.<%) w.search_text
    and extensions.similarity(public.norm(concat_ws(' ', w.name, w.winery)), full_q) > 0.35
  order by extensions.similarity(public.norm(concat_ws(' ', w.name, w.winery)), full_q) desc
  limit 3;
end $$;
