// Testet 08_sozial.sql: Gruppen, Sichtbarkeit, Weinabend-Verdeckung, Empfehlungen, Community-Werte.
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
  alter table storage.objects enable row level security;
`)
for (const f of ['01_schema.sql', '02_glossar.sql', '03_beispielweine.sql', '04_update_suche.sql', '07_update_merkliste_suche.sql', '08_sozial.sql', '08_sozial.sql']) {
  await db.exec(readFileSync(`${app}/supabase/${f}`, 'utf8'))
}
console.log('OK Skripte (08 zweimal)')
await db.exec(`
  grant usage on schema public, extensions, auth to authenticated; grant execute on function auth.uid() to authenticated;
  grant select, insert, update, delete on public.ratings, public.wines, public.wine_grapes, public.grapes, public.profiles to authenticated;
  revoke update on public.profiles from authenticated; grant update (display_name) on public.profiles to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
  grant execute on all functions in schema public, extensions to authenticated;
`)
const U = { ich: '11111111-1111-1111-1111-111111111111', ben: '22222222-2222-2222-2222-222222222222', fremd: '33333333-3333-3333-3333-333333333333' }
await db.exec(`insert into auth.users values ('${U.ich}', 'ich@x.de'), ('${U.ben}', 'ben@x.de'), ('${U.fremd}', 'fremd@x.de')`)
const as = (u) => db.exec(`reset role; select set_config('request.jwt.claim.sub', '${u}', false); set role authenticated;`)
const q = async (label, sql, p) => { const r = await db.query(sql, p); console.log(label, JSON.stringify(r.rows)); return r.rows }
const fail = async (label, sql, p) => {
  try { const r = await db.query(sql, p); console.log('FEHLER erlaubt:', label, r.affectedRows, JSON.stringify(r.rows)) } catch (e) { console.log('OK verweigert:', label, '-', e.message.split('\n')[0]) }
}
const wine = (await db.query("select id from public.wines order by id limit 2")).rows.map((r) => r.id)

await as(U.ich)
const g = (await q('Gruppe anlegen', "select * from public.create_group('Weinrunde')"))[0]
await db.query('insert into public.ratings (wine_id, score) values ($1, 90)', [wine[0]])
await db.query('insert into public.ratings (wine_id, score, shared) values ($1, 70, false)', [wine[0]])

await as(U.ben)
await fail('Beitritt mit falschem Code', "select public.join_group('FALSCH')")
await q('Ben tritt bei', 'select public.join_group($1) as gid', [g.invite_code.toLowerCase()])
await q('Ben sieht Bewertungen von ich (nur geteilte)', 'select user_id = $1 as von_ich, score from public.ratings where user_id <> $2', [U.ich, U.ben])
await db.query('insert into public.ratings (wine_id, score) values ($1, 80)', [wine[0]])
await q('Ben: Community Wein 1', 'select n, raters, round(avg_score) avg from public.wine_community($1) where is_total', [wine[0]])

await as(U.fremd)
await q('Fremd sieht Gruppen', 'select count(*)::int n from public.groups')
await q('Fremd sieht fremde Bewertungen', 'select count(*)::int n from public.ratings')
await q('Fremd: Community Wein 1', 'select n from public.wine_community($1) where is_total', [wine[0]])

// Weinabend
await as(U.ich)
const t = (await q('Weinabend anlegen', 'insert into public.tastings (group_id, title) values ($1, $2) returning id', [g.id, 'Abend bei mir']))[0]
await q('Wein hinzufügen', 'insert into public.tasting_wines (tasting_id, wine_id, position) values ($1, $2, 1) returning *', [t.id, wine[1]])
await as(U.ben)
await fail('Ben fügt Wein hinzu (nicht Host)', 'insert into public.tasting_wines (tasting_id, wine_id) values ($1, $2)', [t.id, wine[0]])
await q('Ben sieht Weine des Abends', 'select wine_id from public.tasting_wines where tasting_id = $1', [t.id])
await db.query('insert into public.ratings (wine_id, score, tasting_id) values ($1, 93, $2)', [wine[1], t.id])
await as(U.ich)
await q('Ich sehe Bens Abend-Note vor Auflösung', 'select count(*)::int n from public.ratings where tasting_id = $1 and user_id = $2', [t.id, U.ben])
await q('Fortschritt', 'select display_name, rated from public.tasting_progress($1)', [t.id])
await as(U.ben)
const upd = await db.query("update public.tastings set status = 'aufgeloest' where id = $1", [t.id])
console.log('Ben löst auf (nicht Host), geänderte Zeilen:', upd.affectedRows)
await as(U.ich)
await q('Ich löse auf', "update public.tastings set status = 'aufgeloest' where id = $1 returning status", [t.id])
await q('Ich sehe Bens Abend-Note nach Auflösung', 'select score from public.ratings where tasting_id = $1 and user_id = $2', [t.id, U.ben])

// Empfehlungen
await q('Empfehlung an Ben', 'insert into public.recommendations (to_user, wine_id, message) values ($1, $2, $3) returning id', [U.ben, wine[1], 'Probier!'])
await fail('Empfehlung an Fremden', 'insert into public.recommendations (to_user, wine_id) values ($1, $2)', [U.fremd, wine[1]])
await as(U.ben)
await q('Ben sieht Empfehlung', 'select message from public.recommendations where to_user = $1', [U.ben])
await q('Ben markiert gelesen', 'update public.recommendations set seen = true returning seen')
await as(U.fremd)
await q('Fremd sieht Empfehlungen', 'select count(*)::int n from public.recommendations')
await as(U.ben)
await q('Ben verlässt Gruppe', 'delete from public.group_members where user_id = $1 returning group_id', [U.ben])
await q('Ben sieht danach Bewertungen von ich', 'select count(*)::int n from public.ratings where user_id = $1', [U.ich])
console.log('FERTIG')
