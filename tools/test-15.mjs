// Testet 15_einfuehrung.sql: Bestandsnutzer mit Bewertung gelten als „gesehen", neue nicht; mark_intro_seen nur fürs eigene Profil.
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
for (const f of ['01_schema.sql', '02_glossar.sql', '03_beispielweine.sql']) await db.exec(sql(f))
const U = { alt: '11111111-1111-1111-1111-111111111111', neu: '22222222-2222-2222-2222-222222222222' }
await db.exec(`insert into auth.users values ('${U.alt}', 'alt@x.de'), ('${U.neu}', 'neu@x.de');
  insert into public.ratings (user_id, wine_id, score) select '${U.alt}', id, 88 from public.wines limit 1;`)
await db.exec(sql('15_einfuehrung.sql'))
await db.exec(sql('15_einfuehrung.sql'))
await db.exec(`grant usage on schema public, auth to authenticated; grant execute on function auth.uid() to authenticated;
  grant select on public.profiles to authenticated; revoke update on public.profiles from authenticated; grant update (display_name) on public.profiles to authenticated;`)
const q = async (label, s) => console.log(label, JSON.stringify((await db.query(s)).rows))
await q('Nach 15:', 'select email, intro_seen_at is not null as gesehen from public.profiles p join auth.users u on u.id = p.id order by email')
await db.exec(`select set_config('request.jwt.claim.sub', '${U.neu}', false); set role authenticated;`)
try { await db.query(`update public.profiles set intro_seen_at = now() where id = '${U.neu}'`); console.log('FEHLER: direkte Änderung erlaubt') } catch (e) { console.log('OK verweigert: direkte Änderung -', e.message.split('\n')[0]) }
await db.query('select public.mark_intro_seen()')
await db.exec('reset role')
await q('Nach mark_intro_seen (neu):', 'select email, intro_seen_at is not null as gesehen from public.profiles p join auth.users u on u.id = p.id order by email')
console.log('FERTIG')
