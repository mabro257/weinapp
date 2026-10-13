// Testet 12: Teilnehmerauswahl, verdeckte Weine, Bewertungsregeln im Weinabend, Preisklasse nachtragen.
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
for (const f of ['01_schema.sql', '02_glossar.sql', '03_beispielweine.sql', '04_update_suche.sql', '07_update_merkliste_suche.sql', '08_sozial.sql', '09_update_zahlen_freunde.sql', '10b_namen_dubletten.sql', '11_iii_freunde_weinabend.sql'])
  await db.exec(sql(f))
const U = { host: '11111111-1111-1111-1111-111111111111', gast: '22222222-2222-2222-2222-222222222222', aussen: '33333333-3333-3333-3333-333333333333', admin: '44444444-4444-4444-4444-444444444444' }
await db.exec(`insert into auth.users values ('${U.host}', 'h@x.de'), ('${U.gast}', 'g@x.de'), ('${U.aussen}', 'a@x.de'), ('${U.admin}', 'ad@x.de');
  update public.profiles set is_admin = true where id = '${U.admin}';`)
const grants = `
  grant usage on schema public, extensions, auth to authenticated; grant execute on function auth.uid() to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  revoke update on public.profiles from authenticated; grant update (display_name) on public.profiles to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
  grant execute on all functions in schema public, extensions to authenticated;
  revoke execute on function public.merge_wine_into(bigint, bigint) from authenticated;`
await db.exec(grants)
const as = (u) => db.exec(`reset role; select set_config('request.jwt.claim.sub', '${u}', false); set role authenticated;`)
const q = async (label, s, p) => { const r = await db.query(s, p); console.log(label, JSON.stringify(r.rows)); return r.rows }
const fail = async (label, s, p) => {
  try { const r = await db.query(s, p); console.log('FEHLER erlaubt:', label, JSON.stringify(r.rows)) } catch (e) { console.log('OK verweigert:', label, '-', e.message.split('\n')[0]) }
}
const [w1, w2] = (await db.query('select id from public.wines order by id limit 2')).rows.map((r) => r.id)

// Gruppe mit drei Mitgliedern, ein alter Abend (vor Update 7) mit sichtbarem Wein
await as(U.host)
const g = (await db.query("select * from public.create_group('Runde')")).rows[0]
for (const u of [U.gast, U.aussen]) { await as(u); await db.query('select public.join_group($1)', [g.invite_code]) }
await as(U.host)
const alt = (await db.query("insert into public.tastings (group_id, title) values ($1, 'Alter Abend') returning id", [g.id])).rows[0].id
await db.query('insert into public.tasting_wines (tasting_id, wine_id, position) values ($1, $2, 1)', [alt, w1])

await db.exec('reset role')
await db.exec(sql('12_weinabend_preis.sql'))
await db.exec(sql('12_weinabend_preis.sql'))
await db.exec(grants)
console.log('OK 12 zweimal')

await as(U.aussen)
await q('Alter Abend: ganze Gruppe sieht ihn und seinen Wein (sichtbar):', 'select (select count(*)::int from public.tastings where id = $1) abend, (select count(*)::int from public.tasting_wines where tasting_id = $1) weine', [alt])

// Neuer Abend: nur Gast dabei, „aussen" nicht
await as(U.host)
const t = (await db.query("insert into public.tastings (group_id, title) values ($1, 'Neuer Abend') returning id", [g.id])).rows[0].id
await db.query('select public.set_tasting_participants($1, $2)', [t, [U.gast]])
await db.query('insert into public.tasting_wines (tasting_id, wine_id, position) values ($1, $2, 1), ($1, $3, 2)', [t, w1, w2])
await q('Host sieht beide Weine, verdeckt:', 'select wine_id, visible from public.tasting_wines where tasting_id = $1 order by position', [t])
await q('Fortschritt (nur Teilnehmer):', 'select p.display_name from public.tasting_progress($1) p', [t])

await as(U.aussen)
await q('Nicht-Teilnehmer sieht den Abend nicht:', 'select count(*)::int n from public.tastings where id = $1', [t])
await fail('Nicht-Teilnehmer bewertet', 'insert into public.ratings (wine_id, score, tasting_id) values ($1, 80, $2)', [w1, t])
await fail('Nicht-Teilnehmer ändert Teilnehmer', 'select public.set_tasting_participants($1, $2)', [t, [U.aussen]])

await as(U.gast)
await q('Gast sieht noch keinen Wein:', 'select count(*)::int n from public.tasting_wines where tasting_id = $1', [t])
await fail('Gast bewertet verdeckten Wein', 'insert into public.ratings (wine_id, score, tasting_id) values ($1, 85, $2)', [w1, t])

await as(U.host)
await db.query('update public.tasting_wines set visible = true where tasting_id = $1 and wine_id = $2', [t, w1])
await as(U.gast)
await q('Gast schaltet Wein sichtbar (0 Zeilen erwartet):','update public.tasting_wines set visible = true where tasting_id = $1 and wine_id = $2 returning wine_id', [t, w2])
await q('Gast sieht jetzt Wein 1:', 'select wine_id from public.tasting_wines where tasting_id = $1', [t])
await q('Gast bewertet Wein 1:', 'insert into public.ratings (wine_id, score, tasting_id) values ($1, 85, $2) returning score', [w1, t])
await q('Normale Bewertung ohne Abend geht weiter:', 'insert into public.ratings (wine_id, score) values ($1, 70) returning score', [w2])

await as(U.host)
await db.query("update public.tastings set status = 'aufgeloest' where id = $1", [t])
await as(U.gast)
await q('Nach dem Aufdecken sieht Gast alle Weine:', 'select count(*)::int n from public.tasting_wines where tasting_id = $1', [t])
await fail('Bewerten nach dem Aufdecken', 'insert into public.ratings (wine_id, score, tasting_id) values ($1, 85, $2)', [w1, t])

// Preisklasse
await db.exec('reset role'); await db.query('update public.wines set price_class = null where id = $1', [w2])
await as(U.gast)
await q('Gast trägt Preisklasse nach:', 'select public.set_wine_price($1, 2::smallint)', [w2])
await fail('Gast ändert vorhandene Preisklasse', 'select public.set_wine_price($1, 4::smallint)', [w2])
await fail('Ungültige Preisklasse', 'select public.set_wine_price($1, 7::smallint)', [w1])
await as(U.admin)
await q('Admin ändert Preisklasse:', 'select public.set_wine_price($1, 3::smallint)', [w2])
await q('Preisklasse jetzt:', 'select price_class from public.wines where id = $1', [w2])

await as(U.gast)
const rec = (await db.query('insert into public.recommendations (to_user, wine_id) values ($1, $2) returning id', [U.host, w1])).rows[0].id
await as(U.host)
await q('Empfänger lehnt Empfehlung ab:', 'delete from public.recommendations where id = $1 returning id', [rec])
console.log('FERTIG')
