// Testet 11: Zahlen im Dublettenvergleich, III Freunde bereinigt, Weinabend löschen (mit/ohne Bewertungen, nur Gastgeber).
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
// Stand beim Nutzer: 06 in der Fassung nach Update 4 (mit DREI FREUNDE Grauburgunder/Riesling/Rosé)
await db.exec(`insert into public.wines (name, winery, country, region, type, source, external_id, status) values
  ('Rosé', 'III Freunde', 'Deutschland', 'Rheinhessen', 'rose', 'manuell', 'iii-freunde/Rosé', 'geprueft'),
  ('DREI FREUNDE Rosé', 'III Freunde', 'Deutschland', 'Rheinhessen', 'rose', 'manuell', 'iii-freunde/DREI FREUNDE Rosé', 'geprueft'),
  ('DREI FREUNDE Riesling', 'III Freunde', 'Deutschland', 'Rheinhessen', 'weiss', 'manuell', 'iii-freunde/DREI FREUNDE Riesling', 'geprueft'),
  ('DREI FREUNDE Grauburgunder', 'III Freunde', 'Deutschland', 'Rheinhessen', 'weiss', 'manuell', 'iii-freunde/DREI FREUNDE Grauburgunder', 'geprueft'),
  ('Riesling Alte Reben', 'III Freunde', 'Deutschland', 'Rheinhessen', 'weiss', 'manuell', 'iii-freunde/Riesling Alte Reben', 'geprueft'),
  ('Riesling', 'III Freunde', 'Deutschland', 'Rheinhessen', 'weiss', 'import', '108488', 'geprueft'),
  ('Grauburgunder Trocken', 'III Freunde', 'Deutschland', 'Rheinhessen', 'weiss', 'import', '106941', 'geprueft')`)
await db.exec(sql('10b_namen_dubletten.sql'))
await db.exec(`
  grant usage on schema public, extensions, auth to authenticated; grant execute on function auth.uid() to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  revoke update on public.profiles from authenticated; grant update (display_name) on public.profiles to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
  grant execute on all functions in schema public, extensions to authenticated;
  revoke execute on function public.merge_wine_into(bigint, bigint) from authenticated;
`)
const U = { host: '11111111-1111-1111-1111-111111111111', gast: '22222222-2222-2222-2222-222222222222' }
await db.exec(`insert into auth.users values ('${U.host}', 'h@x.de'), ('${U.gast}', 'g@x.de');
  update public.profiles set is_admin = true where id = '${U.host}';`)
const as = (u) => db.exec(`reset role; select set_config('request.jwt.claim.sub', '${u}', false); set role authenticated;`)
const q = async (label, s, p) => { const r = await db.query(s, p); console.log(label, JSON.stringify(r.rows)); return r.rows }
const fail = async (label, s, p) => {
  try { const r = await db.query(s, p); console.log('FEHLER erlaubt:', label, JSON.stringify(r.rows)) } catch (e) { console.log('OK verweigert:', label, '-', e.message.split('\n')[0]) }
}
const wid = async (ext) => (await db.query('select id from public.wines where external_id = $1', [ext])).rows[0].id

// Gast hat den DREI FREUNDE Rosé bewertet
await as(U.host)
const g = (await db.query("select * from public.create_group('Runde')")).rows[0]
await as(U.gast)
await db.query('select public.join_group($1)', [g.invite_code])
await db.query('insert into public.ratings (wine_id, score) values ($1, 87)', [await wid('iii-freunde/DREI FREUNDE Rosé')])

await db.exec('reset role')
await db.exec(sql('11_iii_freunde_weinabend.sql'))
await db.exec(sql('11_iii_freunde_weinabend.sql')) // zweiter Lauf harmlos
await db.exec(sql('06_weingut_iii_freunde.sql')) // neue 06 darf nichts doppelt anlegen
await q('III Freunde danach:', "select name, merged_into is not null as zusammengefuehrt from public.wines where winery = 'III Freunde' order by merged_into nulls first, name")
await q('Bewertung beim Rosé:', "select count(*)::int n from public.ratings where wine_id = $1", [await wid('iii-freunde/Rosé')])
await q('token_key III vs drei:', "select public.token_key('III Freunde') a, public.token_key('DREI FREUNDE') b, public.token_key('Grauburgunder Trocken') c")

await as(U.host)
await q('Dubletten-Kandidaten:', 'select a_name, a_source, b_name, b_source, round(score::numeric, 2) s from public.duplicate_candidates()')

// Weinabende
const mk = async (title) => (await db.query("insert into public.tastings (group_id, title, event_date) values ($1, $2, current_date) returning id", [g.id, title])).rows[0].id
const rate = async (u, t, w, s) => { await as(u); await db.query('insert into public.ratings (wine_id, score, tasting_id) values ($1, $2, $3)', [w, s, t]) }
const w1 = await wid('108488')
await as(U.host)
const t1 = await mk('Abend mit Löschen'), t2 = await mk('Abend ohne Löschen')
await db.query('insert into public.tasting_wines (tasting_id, wine_id) values ($1, $3), ($2, $3)', [t1, t2, w1])
await rate(U.host, t1, w1, 90); await rate(U.gast, t1, w1, 80)
await rate(U.host, t2, w1, 91); await rate(U.gast, t2, w1, 81)

await as(U.gast)
await fail('Gast löscht Abend', 'select public.delete_tasting($1, true)', [t1])
await q('Gast sieht Hosts Note im offenen Abend nicht:', 'select count(*)::int n from public.ratings where user_id = $1 and tasting_id = $2', [U.host, t2])
await as(U.host)
await q('Host löscht t1 mit Bewertungen (Anzahl gelöscht):', 'select public.delete_tasting($1, true) n', [t1])
await q('Host löscht t2 ohne Bewertungen:', 'select public.delete_tasting($1, false) n', [t2])
await db.exec('reset role')
await q('Übrig: Bewertungen von t1 / t2 (ohne Abend):', "select (select count(*)::int from public.ratings where score in (90, 80)) t1, (select count(*)::int from public.ratings where score in (91, 81) and tasting_id is null) t2, (select count(*)::int from public.tastings) abende")
await as(U.gast)
await q('Gast sieht Hosts Note aus t2 jetzt als normale Bewertung:', 'select score from public.ratings where user_id = $1', [U.host])
console.log('FERTIG')
