-- =====================================================================
-- Großer Katalogimport aus X-Wines (CC0, 100.646 Weine).
-- NICHT im SQL Editor ausführen: Dieses Skript läuft über die GitHub Action
-- „Katalog-Import" (psql), weil die Daten für den Editor zu groß sind.
-- Kann gefahrlos wiederholt werden: bereits importierte Weine werden übersprungen.
-- =====================================================================

-- 1. Seltene Rebsorten ohne Glossartext ergänzen
create temp table imp_grapes (name text, color text);
\copy imp_grapes from 'data/rebsorten_extra.csv' with (format csv, header)
insert into public.grapes (name, color)
select name, color from imp_grapes
on conflict (name) do nothing;

-- 2. Weine in eine Zwischentabelle laden
create temp table imp (
  external_id text, name text, winery text, country text, region text,
  type text, body smallint, acidity smallint, grapes text
);
\copy imp from 'data/katalog.csv' with (format csv, header)

-- Suchtext-Trigger der Rebsorten-Tabelle kurz aussetzen, Suchtext wird am Ende einmal neu berechnet
alter table public.wine_grapes disable trigger wine_grapes_touch;

-- 3. Weine anlegen
insert into public.wines (name, winery, country, region, type, body, acidity, source, external_id, status, created_by)
select name, nullif(winery, ''), nullif(country, ''), nullif(region, ''), nullif(type, ''),
       body, acidity, 'import', external_id, 'geprueft', null
from imp
on conflict (source, external_id) where external_id is not null do nothing;

-- 4. Rebsorten zuordnen (Reihenfolge bleibt erhalten, die erste ist die Hauptrebsorte)
insert into public.wine_grapes (wine_id, grape_id, position)
select w.id, g.id, x.ord
from imp i
join public.wines w on w.source = 'import' and w.external_id = i.external_id
cross join lateral unnest(string_to_array(i.grapes, '|')) with ordinality as x(gname, ord)
join public.grapes g on g.name = x.gname
on conflict do nothing;

alter table public.wine_grapes enable trigger wine_grapes_touch;

-- 5. Suchtext für alle importierten Weine berechnen (inkl. Rebsorten und Synonyme)
update public.wines set name = name where source = 'import';

-- 6. Erfundene Beispielweine entfernen, aber nur, wenn niemand sie bewertet hat
delete from public.wines w
where w.source = 'demo'
  and not exists (select 1 from public.ratings r where r.wine_id = w.id);

analyze public.wines;
analyze public.wine_grapes;

select
  (select count(*) from public.wines where source = 'import') as importierte_weine,
  (select count(*) from public.wine_grapes) as rebsorten_zuordnungen,
  (select count(*) from public.grapes) as rebsorten_gesamt,
  (select count(*) from public.grapes where short is not null) as rebsorten_mit_glossar;
