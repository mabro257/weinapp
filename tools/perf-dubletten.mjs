// Laufzeit der Dubletten-Prüfung mit dem vollen Katalog (ca. 106.000 Weine) und 80 bewerteten Weinen.
// Aufruf: node tools/perf-dubletten.mjs .          (Stand bis 12)
//         node tools/perf-dubletten.mjs . mit13    (zusätzlich 13_dubletten_schneller.sql)
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'

const app = process.argv[2]
const with13 = process.argv[3] === 'mit13'
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
for (const f of ['01_schema.sql', '02_glossar.sql', '04_update_suche.sql', '07_update_merkliste_suche.sql', '08_sozial.sql', '09_update_zahlen_freunde.sql', '10b_namen_dubletten.sql', '11_iii_freunde_weinabend.sql', '12_weinabend_preis.sql'])
  await db.exec(sql(f))
const files = {
  'data/rebsorten_extra.csv': readFileSync(`${app}/data/rebsorten_extra.csv`),
  'data/katalog.csv': gunzipSync(readFileSync(`${app}/data/katalog.csv.gz`)),
  'data/off_katalog.csv': gunzipSync(readFileSync(`${app}/data/off_katalog.csv.gz`)),
}
let chunk = ''
// wie beim Nutzer: Katalog wurde ohne match_key importiert, 13 berechnet ihn nachträglich
const imp = sql('05_katalog_import.sql').replace(/,\s*match_key = [^\n]+/, '')
for (const line of imp.split('\n')) {
  const m = line.match(/^\\copy (\w+) from '([^']+)' with \((.+)\)/)
  if (m) {
    if (chunk.trim()) await db.exec(chunk)
    chunk = ''
    await db.query(`copy ${m[1]} from '/dev/blob' with (${m[3]})`, [], { blob: new Blob([files[m[2]]]) })
  } else chunk += line + '\n'
}
await db.exec(chunk)
if (with13) {
  const t = Date.now()
  await db.exec(sql('13_dubletten_schneller.sql'))
  console.log('13 ausgeführt in s:', ((Date.now() - t) / 1000).toFixed(1))
}
const A = '11111111-1111-1111-1111-111111111111'
await db.exec(`insert into auth.users values ('${A}', 'a@x.de'); update public.profiles set is_admin = true where id = '${A}';
  grant usage on schema public, extensions, auth to authenticated; grant execute on function auth.uid() to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
  grant execute on all functions in schema public, extensions to authenticated;`)
// 80 bewertete Weine mit typischen, häufigen Namen + 3 Handeinträge als Dubletten
await db.exec(`insert into public.ratings (user_id, wine_id, score)
  select '${A}', id, 85 from (select id from public.wines where name ~* '^(riesling|chardonnay|pinot noir|merlot|rose|prosecco|chianti|grauburgunder|sauvignon blanc|rioja)' order by id limit 60) x;
  insert into public.ratings (user_id, wine_id, score) select '${A}', id, 88 from (select id from public.wines order by md5(id::text) limit 20) y;
  insert into public.wines (name, winery, type, created_by) values ('Lugana I Frati', 'Ca dei Frati', 'weiss', '${A}'), ('Riesling', 'III Freunde', 'weiss', '${A}'), ('Brunelo di Montalcino', 'Campione', 'rot', '${A}');`)
await db.exec(`select set_config('request.jwt.claim.sub', '${A}', false); set role authenticated;`)
let t = Date.now()
const r = await db.query('select a_name, a_winery, b_name, b_winery, round(score::numeric, 2) s from public.duplicate_candidates()')
console.log(`duplicate_candidates: ${((Date.now() - t) / 1000).toFixed(1)} s, ${r.rows.length} Paare`)
for (const x of r.rows.slice(0, 12)) console.log('  ', x.a_name, '|', x.a_winery, '  ~  ', x.b_name, '|', x.b_winery, x.s)
for (const [n, w] of [['Lugana - I Frati', 'Ca del Frati'], ['Riesling', ''], ['Brunelo di Montalcino', 'Campione']]) {
  t = Date.now()
  const s = await db.query('select name, winery from public.similar_wines($1, $2)', [n, w])
  console.log(`similar_wines("${n}", "${w}") ${Date.now() - t} ms:`, JSON.stringify(s.rows))
}
