-- Weingut III Freunde: Sortiment laut Online-Shop (dreifreundeweine.de, Stand 10.10.2026, bereinigt 13.10.2026).
-- Ergänzt die Weine, die im X-Wines-Katalog fehlen. Im SQL Editor ausführen, kann mehrfach laufen.
-- Namensregel: ohne Weingut im Namen („DREI FREUNDE Riesling" → „Riesling"). Die Kennung (external_id)
-- bleibt beim alten Namen, damit ein erneuter Lauf keine Doppelten anlegt. „DREI FREUNDE Rosé" = „Rosé".
with neu(name, type, grape, ext) as (values
  ('Sauvignon Blanc', 'weiss', 23, 'Sauvignon Blanc'),
  ('Weissburgunder', 'weiss', 25, 'Weissburgunder'),
  ('Riesling Alte Reben', 'weiss', 20, 'Riesling Alte Reben'),
  ('Rosé', 'rose', null::int, 'Rosé'),
  ('Pinot Noir Rosé Sekt', 'schaum', 3, 'Pinot Noir Rosé Sekt'),
  ('Grauburgunder', 'weiss', 24, 'DREI FREUNDE Grauburgunder'),
  ('Riesling', 'weiss', 20, 'DREI FREUNDE Riesling'),
  ('Riesling Null (alkoholfrei)', 'weiss', 20, 'Riesling Null (alkoholfrei)'),
  ('Rosé Null (alkoholfrei)', 'rose', null, 'Rosé Null (alkoholfrei)'),
  ('Rosé Sparkling Null (alkoholfrei)', 'schaum', null, 'Rosé Sparkling Null (alkoholfrei)')
), ins as (
  insert into public.wines (name, winery, country, region, type, source, external_id, status, created_by)
  select n.name, 'III Freunde', 'Deutschland', 'Rheinhessen', n.type, 'manuell', 'iii-freunde/' || n.ext, 'geprueft', null
  from neu n
  on conflict (source, external_id) where external_id is not null do nothing
  returning id, external_id
)
insert into public.wine_grapes (wine_id, grape_id, position)
select i.id, n.grape, 1
from ins i join neu n on 'iii-freunde/' || n.ext = i.external_id
where n.grape is not null;
