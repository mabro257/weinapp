// Testet Glossar, Suche-Update und den kompletten Katalogimport gegen PGlite, inkl. Laufzeiten der Suche.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
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
  alter table storage.objects enable row level security;
`)
const sql = (f) => readFileSync(`${app}/supabase/${f}`, 'utf8')
for (const f of ['01_schema.sql', '02_glossar.sql', '03_beispielweine.sql', '04_update_suche.sql', '07_update_merkliste_suche.sql', '08_sozial.sql', '09_update_zahlen_freunde.sql', '10b_namen_dubletten.sql', '11_iii_freunde_weinabend.sql', '12_weinabend_preis.sql', '13_dubletten_schneller.sql']) {
  await db.exec(sql(f)); console.log('OK', f)
}
// Nutzer, der einen Demo-Wein bewertet hat (darf beim Import nicht gelöscht werden)
await db.exec(`insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'a@example.com');
  insert into public.ratings (user_id, wine_id, score) select '11111111-1111-1111-1111-111111111111', id, 90 from public.wines where external_id = '1' and source = 'demo';`)

// 05 ausführen: \copy-Zeilen durch COPY aus Blob ersetzen
const files = {
  'data/rebsorten_extra.csv': readFileSync(`${app}/data/rebsorten_extra.csv`),
  'data/katalog.csv': gunzipSync(readFileSync(`${app}/data/katalog.csv.gz`)),
  'data/off_katalog.csv': gunzipSync(readFileSync(`${app}/data/off_katalog.csv.gz`)),
}
const t0 = Date.now()
let chunk = ''
for (const line of sql('05_katalog_import.sql').split('\n')) {
  const m = line.match(/^\\copy (\w+) from '([^']+)' with \((.+)\)/)
  if (m) {
    if (chunk.trim()) await db.exec(chunk)
    chunk = ''
    await db.query(`copy ${m[1]} from '/dev/blob' with (${m[3]})`, [], { blob: new Blob([files[m[2]]]) })
  } else chunk += line + '\n'
}
const res = await db.exec(chunk)
console.log('Import-Dauer s:', ((Date.now() - t0) / 1000).toFixed(1))
console.log('Ergebnis:', JSON.stringify(res[res.length - 1].rows))
console.log(JSON.stringify((await db.query("select source, count(*)::int from public.wines group by source")).rows))

// Suche als Nutzer
await db.exec(`grant usage on schema public, extensions, auth to authenticated; grant execute on function auth.uid() to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant execute on all functions in schema public, extensions to authenticated;
  select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false); set role authenticated;`)
for (const q of ['valdo prosecco', 'maison galhaud', 'chinati classico', 'pinot', 'lugana','chianti classico riserva', 'chainti', 'pinot noir baden', 'barolo', 'riesling mosel', 'spatburgunder', 'ca dei frati', 'r']) {
  const t = Date.now()
  const r = await db.query('select name, winery, region, main_grape, type, best from public.search_wines($1)', [q])
  console.log(`Suche "${q}" (${Date.now() - t} ms, ${r.rows.length}):`, JSON.stringify(r.rows.slice(0, 4).map((x) => `${x.best ? '*' : ''}${x.name} | ${x.winery} | ${x.main_grape} | ${x.type}`)))
}
for (const [n, w] of [['Lugana', 'Ca dei Frati'], ['Chianti Classico', '']]) {
  const t = Date.now()
  const r = await db.query('select name, winery from public.similar_wines($1, $2)', [n, w])
  console.log(`Ähnlich "${n}" (${Date.now() - t} ms):`, JSON.stringify(r.rows))
}
await db.exec('reset role')
const ex = await db.query("explain select * from public.wines w where 'barolo' operator(extensions.<%) w.search_text")
console.log('Plan <%:', ex.rows.map((r) => r['QUERY PLAN']).join(' / '))
const size = await db.query("select pg_size_pretty(pg_total_relation_size('public.wines')) w, pg_size_pretty(pg_total_relation_size('public.wine_grapes')) g")
console.log('Größe:', JSON.stringify(size.rows))

// Merkliste
await db.exec(`reset role; grant select, insert, delete on public.saved_wines to authenticated; set role authenticated;`)
await db.query('insert into public.saved_wines (wine_id) select id from public.wines limit 2')
console.log('Merkliste:', JSON.stringify((await db.query('select count(*)::int n from public.saved_wines')).rows))
await db.exec(`reset role; select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false); set role authenticated;`)
console.log('Merkliste fremder Nutzer sieht:', JSON.stringify((await db.query('select count(*)::int n from public.saved_wines')).rows))
await db.exec('reset role')
console.log(JSON.stringify((await db.query("select left(external_id,4) src, count(*)::int from public.wines group by 1 order by 2 desc limit 3")).rows))
