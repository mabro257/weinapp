// Erzeugt supabase/02_glossar.sql und 03_beispielweine.sql aus den TS-Daten der App.
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const app = process.argv[2]
const { GRAPES } = await import(pathToFileURL(path.join(app, 'src/lib/grapesData.ts')).href)
const { DEMO_WINES } = await import(pathToFileURL(path.join(app, 'src/lib/demoData.ts')).href)

const s = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const n = (v) => (v === null || v === undefined ? 'null' : String(v))
const arr = (a) => `array[${a.map(s).join(', ')}]::text[]`

let g = `-- Rebsorten-Glossar (Texte von Claude erstellt, bitte prüfen)
-- Nach 01_schema.sql im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
insert into public.grapes (id, name, synonyms, color, short, aromas, regions, body, acidity, tannin, food) values
`
g += GRAPES.map((x) => `  (${x.id}, ${s(x.name)}, ${arr(x.synonyms)}, ${s(x.color)}, ${s(x.short)}, ${arr(x.aromas)}, ${s(x.regions)}, ${n(x.body)}, ${n(x.acidity)}, ${n(x.tannin)}, ${s(x.food)})`).join(',\n')
g += `
on conflict (id) do update set name = excluded.name, synonyms = excluded.synonyms, color = excluded.color,
  short = excluded.short, aromas = excluded.aromas, regions = excluded.regions, body = excluded.body,
  acidity = excluded.acidity, tannin = excluded.tannin, food = excluded.food;

-- Zähler hinter die vergebenen IDs setzen, damit neue Rebsorten keine Kollision erzeugen
select setval(pg_get_serial_sequence('public.grapes', 'id'), (select max(id) from public.grapes));
`
writeFileSync(path.join(app, 'supabase/02_glossar.sql'), g)

let w = `-- Beispielweine für den Start (source = 'demo').
-- Werden später durch den großen Katalogimport ergänzt. Löschen mit:
--   delete from public.wines where source = 'demo';
-- Nach 02_glossar.sql im SQL Editor ausführen.
insert into public.wines (name, winery, country, region, type, price_class, body, acidity, source, external_id, status, created_by) values
`
w += DEMO_WINES.map((x) => `  (${s(x.name)}, ${s(x.winery)}, ${s(x.country)}, ${s(x.region)}, ${s(x.type)}, ${n(x.priceClass)}, ${n(x.body)}, ${n(x.acidity)}, 'demo', '${x.id}', 'geprueft', null)`).join(',\n')
w += `
on conflict (source, external_id) where external_id is not null do nothing;

insert into public.wine_grapes (wine_id, grape_id, position)
select w.id, v.grape_id, v.position
from (values
`
w += DEMO_WINES.flatMap((x) => x.grapeIds.map((gid, i) => `  ('${x.id}', ${gid}, ${i + 1})`)).join(',\n')
w += `
) as v(ext, grape_id, position)
join public.wines w on w.source = 'demo' and w.external_id = v.ext
on conflict do nothing;
`
writeFileSync(path.join(app, 'supabase/03_beispielweine.sql'), w)
console.log('ok')
