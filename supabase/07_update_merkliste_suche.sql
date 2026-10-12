-- =====================================================================
-- Update 12.10.2026: Merkliste und Suche mit Etikettbild und „bester Treffer".
-- Im Supabase SQL Editor ausführen. Kann gefahrlos mehrfach laufen.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Merkliste: gespeicherte Weine je Nutzer
-- ---------------------------------------------------------------------
create table if not exists public.saved_wines (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  wine_id bigint not null references public.wines (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, wine_id)
);
create index if not exists saved_wines_wine on public.saved_wines (wine_id);
alter table public.saved_wines enable row level security;
drop policy if exists "Eigene Merkliste" on public.saved_wines;
create policy "Eigene Merkliste" on public.saved_wines for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.saved_wines to authenticated;

-- ---------------------------------------------------------------------
-- 2. Suche: liefert zusätzlich Weintyp, Etikettbild und Kennzeichen „bester Treffer".
--    Die Rückgabe ändert sich, deshalb wird die alte Funktion zuerst entfernt.
-- ---------------------------------------------------------------------
drop function if exists public.search_wines(text, int);

create function public.search_wines(q text, lim int default 20)
returns table (id bigint, name text, winery text, region text, main_grape text, my_avg numeric,
               type text, label_path text, best boolean)
language plpgsql set search_path = ''
as $$
declare
  phrase text := trim(regexp_replace(public.norm(q), '[^a-z0-9]+', ' ', 'g'));
  toks text[] := array(select t from unnest(regexp_split_to_array(phrase, ' ')) t where t <> '');
  lead text;
  best_n int := null;
  n int;
  tok text;
begin
  if coalesce(array_length(toks, 1), 0) = 0 then
    return;
  end if;
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
    select w.id, w.name, w.winery, w.region, w.type, w.label_path, w.search_text, public.norm(w.name) as nname
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
