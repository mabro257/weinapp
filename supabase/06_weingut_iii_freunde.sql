-- Weingut III Freunde: Sortiment laut Online-Shop (dreifreundeweine.de, Stand 10.10.2026).
-- Ergänzt die Weine, die im X-Wines-Katalog fehlen. Im SQL Editor ausführen, kann mehrfach laufen.
with neu(name, type, grape) as (values
  ('Sauvignon Blanc', 'weiss', 23),
  ('Weissburgunder', 'weiss', 25),
  ('Riesling Alte Reben', 'weiss', 20),
  ('Rosé', 'rose', null::int),
  ('Pinot Noir Rosé Sekt', 'schaum', 3),
  ('DREI FREUNDE Grauburgunder', 'weiss', 24),
  ('DREI FREUNDE Riesling', 'weiss', 20),
  ('DREI FREUNDE Rosé', 'rose', null),
  ('Riesling Null (alkoholfrei)', 'weiss', 20),
  ('Rosé Null (alkoholfrei)', 'rose', null),
  ('Rosé Sparkling Null (alkoholfrei)', 'schaum', null)
), ins as (
  insert into public.wines (name, winery, country, region, type, source, external_id, status, created_by)
  select n.name, 'III Freunde', 'Deutschland', 'Rheinhessen', n.type, 'manuell', 'iii-freunde/' || n.name, 'geprueft', null
  from neu n
  on conflict (source, external_id) where external_id is not null do nothing
  returning id, name
)
insert into public.wine_grapes (wine_id, grape_id, position)
select i.id, n.grape, 1
from ins i join neu n on n.name = i.name
where n.grape is not null;
