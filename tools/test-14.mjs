// Testet 14_suche_schneller.sql: gleiche Treffer wie vorher (Tippfehler, Synonym, Akzent, Zahlen, eigene Weine zuerst, Dubletten ausgeblendet).
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'

const app = process.argv[2]
const db = new PGlite({ extensions: { pg_trgm, unaccent } })
await db.exec(`
  create schema extensions; create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id serial primary key, bucket_id text, name text);
`)
const sql = (f) => readFileSync(`${app}/supabase/${f}`, 'utf8')
for (const f of ['01_schema.sql', '02_glossar.sql', '03_beispielweine.sql', '04_update_suche.sql', '07_update_merkliste_suche.sql', '08_sozial.sql', '09_update_zahlen_freunde.sql', '06_weingut_iii_freunde.sql', '10b_namen_dubletten.sql', '11_iii_freunde_weinabend.sql', '12_weinabend_preis.sql', '13_dubletten_schneller.sql'])
  await db.exec(sql(f))
await db.exec(`insert into public.wines (name, winery, source, external_id) values
  ('Grauburgunder Trocken', 'III Freunde', 'import', 'x1'), ('Dornfelder Halbtrocken', '3 Talente', 'import', 'x2'),
  ('No. 1 Blanc de Noir', 'Brogsitter', 'import', 'x3'), ('Riesling 2013', 'Weingut Jahr', 'import', 'x4'),
  ('Chianti Classico Riserva', 'Doppelt', 'import', 'x5')`)
await db.exec(sql('14_suche_schneller.sql'))
await db.exec(sql('14_suche_schneller.sql'))
console.log('OK 14 zweimal')
const U = '11111111-1111-1111-1111-111111111111'
await db.exec(`insert into auth.users values ('${U}', 'a@x.de');
  grant usage on schema public, extensions, auth to authenticated; grant execute on function auth.uid() to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant execute on all functions in schema public, extensions to authenticated;`)
// Zweiter Chianti als Dublette zusammengeführt: darf nicht mehr erscheinen
await db.exec(`update public.wines set merged_into = (select id from public.wines where external_id = '1' and source = 'demo') where external_id = 'x5';
  select set_config('request.jwt.claim.sub', '${U}', false); set role authenticated;`)
await db.query("insert into public.ratings (wine_id, score) select id, 90 from public.wines where name = 'Chianti Classico' limit 1")
const show = async (q) => {
  const r = await db.query('select name, winery, best, my_avg from public.search_wines($1, 4)', [q])
  console.log(`"${q}":`, JSON.stringify(r.rows.map((x) => `${x.best ? '*' : ''}${x.name} | ${x.winery}${x.my_avg ? ` (Ø ${x.my_avg})` : ''}`)))
}
for (const q of ['r', 'chianti', 'chianti classico riserva', 'chainti', 'pinot noir', 'cotes du rhone', 'côtes', 'drei freunde grauburgunder', 'iii freunde', '3 talente',
  'no eins blanc', 'riesling 2013', 'spatburgunder', 'riesling alte reben'])
  await show(q)
await db.exec('reset role')
// Umbenennen aktualisiert name_norm über den Trigger
await db.exec("update public.wines set name = 'Drei Zinnen' where external_id = 'x2'")
console.log('name_norm nach Umbenennen:', JSON.stringify((await db.query("select name_norm from public.wines where external_id = 'x2'")).rows))
console.log('FERTIG')
