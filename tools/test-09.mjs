// Testet 09_update_zahlen_freunde.sql: Umbenennung ELF → DREI FREUNDE und Zahlen in der Suche.
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
const sql = (f) => readFileSync(`${app}/supabase/${f}`, 'utf8')
for (const f of ['01_schema.sql', '02_glossar.sql', '03_beispielweine.sql', '04_update_suche.sql', '07_update_merkliste_suche.sql'])
  await db.exec(sql(f))
// Stand beim Nutzer: alte Fassung von 06 mit ELF FREUNDE
await db.exec(sql('06_weingut_iii_freunde.sql').replaceAll("'DREI FREUNDE", "'ELF FREUNDE"))
await db.exec(`insert into public.wines (name, winery, source, external_id) values
  ('Grauburgunder Trocken', 'III Freunde', 'import', 'x1'),
  ('Dornfelder Halbtrocken', '3 Talente', 'import', 'x2'),
  ('No. 1 Blanc de Noir', 'Brogsitter', 'import', 'x3'),
  ('Drei Zinnen Lagrein', 'Kellerei Test', 'import', 'x4'),
  ('Riesling 2013', 'Weingut Jahr', 'import', 'x5')`)
const show = async (label, q) => console.log(label, JSON.stringify((await db.query(q)).rows.map((r) => Object.values(r).join(' | '))))

await db.exec(sql('09_update_zahlen_freunde.sql'))
await db.exec(sql('09_update_zahlen_freunde.sql')) // zweiter Lauf muss harmlos sein
await show('III Freunde:', "select name, external_id, search_text from public.wines where winery = 'III Freunde' order by name")
await show('Rest ELF:', "select count(*) from public.wines where name ~* 'elf freunde'")
// 06 neu laufen lassen darf keine Dubletten erzeugen
await db.exec(sql('06_weingut_iii_freunde.sql'))
await show('Anzahl III Freunde nach erneutem 06:', "select count(*) from public.wines where winery = 'III Freunde'")
for (const q of ['3 freunde grauburgunder', 'drei freunde grauburgunder', 'iii freunde grauburgunder', 'drei freunde riesling',
                 '3 talente', 'drei talente', 'no 1 blanc', 'no eins blanc', '3 zinnen', 'drei zinnen', 'riesling 2013', 'chianti'])
  await show(`Suche "${q}":`, `select name, winery, best from public.search_wines('${q}', 4)`)
