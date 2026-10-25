import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
const app = process.argv[2]
const db = new PGlite({ extensions: { pg_trgm, unaccent } })
await db.exec(`create schema extensions; create schema auth; create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create role anon; create role authenticated; create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id serial primary key, bucket_id text, name text);`)
for (const f of ['01_schema.sql', '02_glossar.sql', '04_update_suche.sql', '06_weingut_iii_freunde.sql', '06_weingut_iii_freunde.sql'])
  await db.exec(readFileSync(`${app}/supabase/${f}`, 'utf8'))
const r = await db.query("select name, type, (select string_agg(g.name, ',') from public.wine_grapes wg join public.grapes g on g.id = wg.grape_id where wg.wine_id = w.id) grapes from public.wines w where winery = 'III Freunde' order by name")
console.log(r.rows.length, JSON.stringify(r.rows))
console.log(JSON.stringify((await db.query("select name from public.search_wines('iii freunde riesling')")).rows))
