// Testet 10a/10b: Namensbereinigung, Zusammenführen (inkl. Merkliste, Weinabend, Empfehlung), ähnliche Weine, Dubletten-Prüfung.
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
for (const f of ['01_schema.sql', '02_glossar.sql', '04_update_suche.sql', '07_update_merkliste_suche.sql', '08_sozial.sql', '09_update_zahlen_freunde.sql'])
  await db.exec(sql(f))
await db.exec(`
  grant usage on schema public, extensions, auth to authenticated; grant execute on function auth.uid() to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  revoke update on public.profiles from authenticated; grant update (display_name) on public.profiles to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
  grant execute on all functions in schema public, extensions to authenticated;
`)
const U = { admin: '11111111-1111-1111-1111-111111111111', ben: '22222222-2222-2222-2222-222222222222' }
await db.exec(`insert into auth.users values ('${U.admin}', 'a@x.de'), ('${U.ben}', 'b@x.de');
  update public.profiles set is_admin = true where id = '${U.admin}';`)
const as = (u) => db.exec(`reset role; select set_config('request.jwt.claim.sub', '${u}', false); set role authenticated;`)
const q = async (label, s, p) => { const r = await db.query(s, p); console.log(label, JSON.stringify(r.rows)); return r.rows }
const fail = async (label, s, p) => {
  try { const r = await db.query(s, p); console.log('FEHLER erlaubt:', label, JSON.stringify(r.rows)) } catch (e) { console.log('OK verweigert:', label, '-', e.message.split('\n')[0]) }
}

// Katalog wie live: X-Wines-Eintrag und Open-Food-Facts-Dublette (alter Name), dazu ein umzubenennender OFF-Wein
await db.exec(`
  insert into public.wines (name, winery, country, region, type, body, acidity, source, external_id, status) values
   ('I Frati Lugana', 'Cà dei Frati', 'Italien', 'Lugana', 'weiss', 3, 4, 'import', '136018', 'geprueft'),
   ('Brolettino Lugana', 'Cà dei Frati', 'Italien', 'Lugana', 'weiss', 4, 3, 'import', '136887', 'geprueft'),
   ('Lugana - I Frati', 'Ca del Frati', 'Italien', null, null, null, null, 'import', 'off:8058456385303', 'geprueft'),
   ('Château Pibran Pauillac 2011', 'Château Pibran', 'Frankreich', null, 'rot', null, null, 'import', 'off:3760020094522', 'geprueft');
  insert into public.wine_grapes (wine_id, grape_id, position)
   select w.id, g.id, 1 from public.wines w, public.grapes g where g.name = 'Turbiana' and w.name like '%Lugana%';
`)
const id = async (ext) => (await db.query('select id from public.wines where external_id = $1', [ext])).rows[0].id
const xw = await id('136018'), offw = await id('off:8058456385303')
console.log('Zeilen in 10a mit Pibran:', (sql('10a_katalog_daten.sql').match(/off:3760020094522/g) ?? []).length)

// Ben hat die OFF-Dublette bewertet, gemerkt, empfohlen bekommen und im Weinabend
await as(U.admin)
const g = (await db.query("select * from public.create_group('Runde')")).rows[0]
await as(U.ben)
await db.query('select public.join_group($1)', [g.invite_code])
await db.query('insert into public.ratings (wine_id, score) values ($1, 88)', [offw])
await db.query('insert into public.saved_wines (wine_id) values ($1)', [offw])
await db.query('insert into public.recommendations (to_user, wine_id) values ($1, $2)', [U.admin, offw])
await as(U.admin)
const t = (await db.query("insert into public.tastings (group_id, title, event_date) values ($1, 'Abend', current_date) returning id", [g.id])).rows[0].id
await db.query('insert into public.tasting_wines (tasting_id, wine_id, position) values ($1, $2, 1)', [t, offw])
// Admin legt einen Wein doppelt von Hand an (anderer Name, gleiches Weingut)
await db.query("insert into public.wines (name, winery, type) values ('Lugana I Frati', 'Ca dei Frati', 'weiss')")
// Zwei verschiedene Weine vom selben Weingut, beide bewertet: dürfen nicht als Dublette gelten
await db.query("insert into public.wines (name, winery, type) values ('Rosso di Montalcino', 'Tenuta Campione', 'rot'), ('Brunello di Montalcino', 'Tenuta Campione', 'rot'), ('Riesling Kabinett', 'Weingut Probestein', 'weiss'), ('Kabinett Riesling', 'Probestein', 'weiss')")
await db.query("insert into public.ratings (wine_id, score) select id, 85 from public.wines where winery in ('Tenuta Campione', 'Weingut Probestein')")
await q('Ähnlich beim Anlegen mit Tippfehler „Brunelo di Montalcino":', "select name, winery from public.similar_wines('Brunelo di Montalcino', 'Campione')")
await q('Ähnliche Weine beim Anlegen „Lugana - I Frati / Ca del Frati":', "select name, winery from public.similar_wines('Lugana - I Frati', 'Ca del Frati')")
await db.exec('reset role')

await db.exec(sql('10a_katalog_daten.sql'))
await db.exec(sql('10b_namen_dubletten.sql'))
await db.exec(sql('10a_katalog_daten.sql'))
await db.exec(sql('10b_namen_dubletten.sql')) // zweiter Lauf harmlos
console.log('OK 10a/10b zweimal')

await q('OFF-Lugana:', 'select name, winery, merged_into = $1 as in_xwines from public.wines where id = $2', [xw, offw])
await q('Pibran umbenannt:', "select name, winery from public.wines where external_id = 'off:3760020094522'")
await q('X-Wines-Lugana übernimmt:', 'select (select count(*) from public.ratings where wine_id = $1)::int bewertungen, (select count(*) from public.saved_wines where wine_id = $1)::int merkliste, (select count(*) from public.tasting_wines where wine_id = $1)::int weinabend, (select count(*) from public.recommendations where wine_id = $1)::int empfehlung', [xw])
await q('Staging aufgeräumt:', "select to_regclass('staging.off_rename') is null as weg")

await as(U.ben)
await fail('merge_wine_into direkt', 'select public.merge_wine_into($1, $2)', [xw, offw])
await fail('merge_wines ohne Admin', 'select public.merge_wines($1, $2)', [xw, offw])
await fail('duplicate_candidates ohne Admin', 'select * from public.duplicate_candidates()')
await q('Suche „i frati lugana" (nur noch ein Lugana I Frati aus dem Katalog + Handeintrag):', "select name, winery from public.search_wines('i frati lugana')")

await as(U.admin)
const cand = await q('Dubletten-Kandidaten:', 'select a_name, a_winery, a_source, b_name, b_winery, b_source, b_ratings, round(score::numeric, 2) s from public.duplicate_candidates()')
const c = (await db.query('select * from public.duplicate_candidates()')).rows[0]
await db.query('select public.dismiss_duplicate($1, $2)', [c.a_id, c.b_id])
await q('Nach „Kein Duplikat":', 'select count(*)::int n from public.duplicate_candidates()')
await db.query('delete from public.duplicate_dismissed')
const manual = (await db.query("select id from public.wines where source = 'manuell'")).rows[0].id
await db.query('select public.merge_wines($1, $2)', [manual, xw])
await q('Nach Zusammenführen:', 'select count(*)::int n from public.duplicate_candidates()')
await q('Admin ändert Katalogwein:', "update public.wines set name = 'I Frati Lugana' where id = $1 returning name", [xw])
await as(U.ben)
await q('Ben darf Katalogwein nicht ändern (0 Zeilen):', "update public.wines set name = 'X' where id = $1 returning name", [xw])
console.log('FERTIG')
