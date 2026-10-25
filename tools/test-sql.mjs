// Testet die Supabase-SQL-Dateien gegen PGlite (echtes Postgres im Prozess) mit nachgebauten Supabase-Teilen.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'

const dir = process.argv[2]
const db = new PGlite({ extensions: { pg_trgm, unaccent } })

// Nachbau der Supabase-Umgebung
await db.exec(`
  create schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  alter table storage.objects enable row level security;
`)

for (const f of ['01_schema.sql', '02_glossar.sql', '03_beispielweine.sql']) {
  await db.exec(readFileSync(`${dir}/${f}`, 'utf8'))
  console.log('OK', f)
}
// Erneutes Ausführen der Seeds muss gefahrlos sein
await db.exec(readFileSync(`${dir}/02_glossar.sql`, 'utf8'))
await db.exec(readFileSync(`${dir}/03_beispielweine.sql`, 'utf8'))
console.log('OK Seeds wiederholt')

// Supabase vergibt diese Rechte automatisch
await db.exec(`
  grant usage on schema public, extensions, auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  revoke update on public.profiles from authenticated; grant update (display_name) on public.profiles to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
  grant execute on all functions in schema extensions to authenticated;
`)

const U1 = '11111111-1111-1111-1111-111111111111'
const U2 = '22222222-2222-2222-2222-222222222222'
await db.exec(`insert into auth.users values ('${U1}', 'anna@example.com'), ('${U2}', 'ben@example.com')`)

const q = async (label, sql, params) => {
  const r = await db.query(sql, params)
  console.log(label, JSON.stringify(r.rows))
  return r.rows
}
const as = async (uid) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`)
}

await q('Profile', 'select display_name, is_admin from public.profiles order by display_name')
await q('Wein-Anzahl', 'select count(*)::int n from public.wines')
await q('Suchtext Wein 1', "select search_text from public.wines where external_id = '1'")

await as(U1)
await q('Suche "chianti ris"', "select name, winery, main_grape from public.search_wines('chianti ris')")
await q('Suche Tippfehler "chainti"', "select name from public.search_wines('chainti')")
await q('Suche Synonym "pinot noir"', "select name from public.search_wines('pinot noir')")
await q('Suche Akzent "cotes"', "select name from public.search_wines('cotes du rhone')")

const w1 = (await q('Wein-ID', "select id from public.wines where external_id = '1'"))[0].id
await db.query('insert into public.ratings (wine_id, score, vintage, body) values ($1, 90, 2021, 4), ($1, 86, 2020, null)', [w1])
await q('Eigene Suche mit Ø', "select name, my_avg from public.search_wines('chianti classico riserva')")

// Neuer Wein mit Rebsorte durch normalen Nutzer
const nw = (await q('Wein anlegen', "insert into public.wines (name, winery) values ('Rosso di Casa', 'Agriturismo Esempio') returning id, created_by, status"))[0]
await q('Rebsorte anlegen', 'insert into public.wine_grapes (wine_id, grape_id, position) values ($1, 2, 1) returning *', [nw.id])
await q('Suche nach neuem Wein über Rebsorte', "select name from public.search_wines('rosso sangiovese')")
await q('Ähnliche Weine', "select name from public.similar_wines('Rosso di Montalcino', '')")

await as(U2)
await db.query('insert into public.ratings (wine_id, score, vintage) values ($1, 80, 2021)', [w1])
await q('U2 sieht nur eigene Bewertungen', 'select count(*)::int n from public.ratings')
await q('Community (U2)', 'select * from public.wine_community($1) order by is_total desc, vintage', [w1])
await q('Rebsorten-Community', 'select * from public.grape_community()')

// Verbotene Aktionen
const expectFail = async (label, sql, params) => {
  try {
    const r = await db.query(sql, params)
    console.log('FEHLER: erlaubt ->', label, r.affectedRows ?? '', JSON.stringify(r.rows))
  } catch (e) {
    console.log('OK verweigert:', label, '-', e.message.split('\n')[0])
  }
}
await expectFail('Admin-Flag selbst setzen', `update public.profiles set is_admin = true where id = '${U2}'`)
await expectFail('Fremden Wein ändern', "update public.wines set name = 'X' where id = $1 returning id", [nw.id])
  .then(async () => {
    const r = await db.query('select name from public.wines where id = $1', [nw.id])
    console.log('  Name danach:', r.rows[0].name)
  })
await expectFail('Bewertung für anderen Nutzer anlegen', `insert into public.ratings (user_id, wine_id, score) values ('${U1}', $1, 50)`, [w1])
await expectFail('Rebsorte anlegen', "insert into public.grapes (name, color) values ('Test', 'rot')")
await expectFail('Merge ohne Admin', 'select public.merge_wines(1, 2)')
await q('Anzeigename ändern', `update public.profiles set display_name = 'Ben' where id = '${U2}' returning display_name`)

await q('Etikett setzen', 'select public.set_wine_label($1, $2)', [w1, `${w1}/a.webp`])
await q('Etikett zweites Mal (bleibt)', 'select public.set_wine_label($1, $2)', [w1, `${w1}/b.webp`])
await db.exec('reset role')
await q('Etikett-Pfad', 'select label_path from public.wines where id = $1', [w1])

// Admin-Merge
await db.exec(`update public.profiles set is_admin = true where id = '${U1}'`)
await as(U1)
await q('Merge als Admin', 'select public.merge_wines($1, $2)', [nw.id, w1])
await db.exec('reset role')
await q('Nach Merge', 'select id, merged_into from public.wines where id = $1', [nw.id])
await as(U1)
await q('Suche zeigt Dublette nicht mehr', "select name from public.search_wines('rosso di casa')")
console.log('FERTIG')
