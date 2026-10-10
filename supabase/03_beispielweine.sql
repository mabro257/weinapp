-- Beispielweine für den Start (source = 'demo').
-- Werden später durch den großen Katalogimport ergänzt. Löschen mit:
--   delete from public.wines where source = 'demo';
-- Nach 02_glossar.sql im SQL Editor ausführen.
insert into public.wines (name, winery, country, region, type, price_class, body, acidity, source, external_id, status, created_by) values
  ('Chianti Classico Riserva', 'Tenuta Beispiel', 'Italien', 'Toskana', 'rot', 2, 4, 3, 'demo', '1', 'geprueft', null),
  ('Chianti Rufina Riserva', 'Fattoria Esempio', 'Italien', 'Toskana', 'rot', 2, 3, 4, 'demo', '2', 'geprueft', null),
  ('Chianti Classico', 'Castello Modello', 'Italien', 'Toskana', 'rot', 2, 3, 4, 'demo', '3', 'geprueft', null),
  ('Brunello di Montalcino', 'Tenuta Campione', 'Italien', 'Toskana', 'rot', 4, 4, 4, 'demo', '4', 'geprueft', null),
  ('Rosso di Montalcino', 'Tenuta Campione', 'Italien', 'Toskana', 'rot', 2, 3, 4, 'demo', '5', 'geprueft', null),
  ('Barolo', 'Cantina Esempio', 'Italien', 'Piemont', 'rot', 4, 4, 5, 'demo', '6', 'geprueft', null),
  ('Barbaresco', 'Produttori Modello', 'Italien', 'Piemont', 'rot', 3, 4, 5, 'demo', '7', 'geprueft', null),
  ('Valtellina Superiore', 'Azienda Prova', 'Italien', 'Lombardei', 'rot', 3, 3, 4, 'demo', '8', 'geprueft', null),
  ('Riesling Smaragd', 'Weingut Musterhof', 'Österreich', 'Wachau', 'weiss', 3, 3, 5, 'demo', '9', 'geprueft', null),
  ('Riesling GG', 'Weingut Beispielberg', 'Deutschland', 'Rheingau', 'weiss', 3, 3, 5, 'demo', '10', 'geprueft', null),
  ('Riesling Kabinett', 'Weingut Probestein', 'Deutschland', 'Mosel', 'weiss', 2, 2, 5, 'demo', '11', 'geprueft', null),
  ('Spätburgunder trocken', 'Weingut Mustermann', 'Deutschland', 'Baden', 'rot', 2, 2, 4, 'demo', '12', 'geprueft', null),
  ('Pinot Noir Réserve', 'Domaine Exemple', 'Frankreich', 'Burgund', 'rot', 4, 3, 4, 'demo', '13', 'geprueft', null),
  ('Grüner Veltliner Federspiel', 'Weingut Probe', 'Österreich', 'Wachau', 'weiss', 2, 3, 4, 'demo', '14', 'geprueft', null),
  ('Rioja Reserva', 'Bodega Ejemplo', 'Spanien', 'Rioja', 'rot', 2, 4, 3, 'demo', '15', 'geprueft', null),
  ('Ribera del Duero Crianza', 'Bodega Muestra', 'Spanien', 'Ribera del Duero', 'rot', 2, 4, 3, 'demo', '16', 'geprueft', null),
  ('Côtes du Rhône', 'Domaine Exemple', 'Frankreich', 'Rhône', 'rot', 1, 3, 3, 'demo', '17', 'geprueft', null),
  ('Bordeaux Supérieur', 'Château Modèle', 'Frankreich', 'Bordeaux', 'rot', 2, 4, 3, 'demo', '18', 'geprueft', null),
  ('Sancerre', 'Domaine Essai', 'Frankreich', 'Loire', 'weiss', 3, 2, 5, 'demo', '19', 'geprueft', null),
  ('Sauvignon Blanc Ried', 'Weingut Steirerprobe', 'Österreich', 'Südsteiermark', 'weiss', 3, 2, 5, 'demo', '20', 'geprueft', null),
  ('Grauburgunder trocken', 'Weingut Kaiserprobe', 'Deutschland', 'Baden', 'weiss', 2, 3, 3, 'demo', '21', 'geprueft', null),
  ('Blaufränkisch Ried', 'Weingut Seeprobe', 'Österreich', 'Burgenland', 'rot', 3, 3, 4, 'demo', '22', 'geprueft', null),
  ('Primitivo di Manduria', 'Masseria Esempio', 'Italien', 'Apulien', 'rot', 2, 5, 2, 'demo', '23', 'geprueft', null),
  ('Prosecco Superiore', 'Cantina Bollicine', 'Italien', 'Venetien', 'schaum', 2, 1, 3, 'demo', '24', 'geprueft', null),
  ('Chablis', 'Domaine Exemple', 'Frankreich', 'Burgund', 'weiss', 3, 2, 4, 'demo', '25', 'geprueft', null)
on conflict (source, external_id) where external_id is not null do nothing;

insert into public.wine_grapes (wine_id, grape_id, position)
select w.id, v.grape_id, v.position
from (values
  ('1', 2, 1),
  ('2', 2, 1),
  ('3', 2, 1),
  ('4', 2, 1),
  ('5', 2, 1),
  ('6', 1, 1),
  ('7', 1, 1),
  ('8', 1, 1),
  ('9', 20, 1),
  ('10', 20, 1),
  ('11', 20, 1),
  ('12', 3, 1),
  ('13', 3, 1),
  ('14', 21, 1),
  ('15', 8, 1),
  ('16', 8, 1),
  ('17', 7, 1),
  ('17', 6, 2),
  ('18', 5, 1),
  ('18', 4, 2),
  ('19', 23, 1),
  ('20', 23, 1),
  ('21', 24, 1),
  ('22', 11, 1),
  ('23', 10, 1),
  ('24', 32, 1),
  ('25', 22, 1)
) as v(ext, grape_id, position)
join public.wines w on w.source = 'demo' and w.external_id = v.ext
on conflict do nothing;
