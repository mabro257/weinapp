// Laufzeit der Katalogsuche (search_wines) mit dem vollen Katalog (ca. 107.000 Weine), wie beim Tippen in der App.
// Aufruf: node tools/perf-suche.mjs .          (Stand bis 13)
//         node tools/perf-suche.mjs . mit14    (zusätzlich 14_suche_schneller.sql)
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'

const app = process.argv[2]
const with14 = process.argv[3] === 'mit14'
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
for (const f of ['01_schema.sql', '02_glossar.sql', '04_update_suche.sql', '07_update_merkliste_suche.sql', '08_sozial.sql', '09_update_zahlen_freunde.sql', '10b_namen_dubletten.sql', '11_iii_freunde_weinabend.sql', '12_weinabend_preis.sql', '13_dubletten_schneller.sql'])
  await db.exec(sql(f))
const files = {
  'data/rebsorten_extra.csv': readFileSync(`${app}/data/rebsorten_extra.csv`),
  'data/katalog.csv': gunzipSync(readFileSync(`${app}/data/katalog.csv.gz`)),
  'data/off_katalog.csv': gunzipSync(readFileSync(`${app}/data/off_katalog.csv.gz`)),
}
// wie beim Nutzer: Katalog ist vor 14 importiert, 14 berechnet die neue Spalte nachträglich
const imp = sql('05_katalog_import.sql').replace(/,\s*name_norm = [^\n]+/, '')
let chunk = ''
for (const line of imp.split('\n')) {
  const m = line.match(/^\\copy (\w+) from '([^']+)' with \((.+)\)/)
  if (m) {
    if (chunk.trim()) await db.exec(chunk)
    chunk = ''
    await db.query(`copy ${m[1]} from '/dev/blob' with (${m[3]})`, [], { blob: new Blob([files[m[2]]]) })
  } else chunk += line + '\n'
}
await db.exec(chunk)
if (with14) {
  const t = Date.now()
  await db.exec(sql('14_suche_schneller.sql'))
  console.log('14 ausgeführt in s:', ((Date.now() - t) / 1000).toFixed(1))
}
const A = '11111111-1111-1111-1111-111111111111'
await db.exec(`insert into auth.users values ('${A}', 'a@x.de');
  grant usage on schema public, extensions, auth to authenticated; grant execute on function auth.uid() to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant execute on all functions in schema public, extensions to authenticated;
  insert into public.ratings (user_id, wine_id, score) select '${A}', id, 88 from public.wines where name ilike 'Barolo%' limit 3;
  select set_config('request.jwt.claim.sub', '${A}', false); set role authenticated;`)
// Tippverlauf wie in der App (jede Eingabe löst eine Suche aus) plus typische Suchen
const queries = ['r', 'ri', 'ries', 'riesling', 'riesling mo', 'riesling mosel', 'pinot', 'pinot noir', 'spatburgunder', 'chianti classico riserva',
  'chainti', 'barolo', 'lugana', 'ca dei frati', '3 freunde', 'prosecco', 'valdo prosecco', 'grauburgunder trocken', 'xyzq']
let total = 0
for (const q of queries) {
  await db.query('select 1') // Leerlauf
  const t = Date.now()
  const r = await db.query('select name, winery, best from public.search_wines($1)', [q])
  const ms = Date.now() - t
  total += ms
  console.log(`${String(ms).padStart(5)} ms  "${q}" (${r.rows.length}): ${r.rows.slice(0, 3).map((x) => `${x.best ? '*' : ''}${x.name} | ${x.winery}`).join('  /  ')}`)
}
console.log('Summe ms:', total)
