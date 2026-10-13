// Bereinigt die Open-Food-Facts-Weine nach den Namensregeln (naming.mjs) und findet Dubletten
// zu X-Wines bzw. innerhalb von Open Food Facts.
// Schreibt: data/off_katalog.csv.gz (bereinigt, ohne Dubletten) und supabase/10a_katalog_daten.sql (Umbenennungen, Zusammenführungen).
// Aufruf: node tools/clean-off.mjs .        (mit --dry nur Statistik und Beispiele)
// Achtung: Einmalig auf den ursprünglichen OFF-Stand angewendet (13.10.2026). Ein zweiter Lauf auf der
// bereits bereinigten Datei liefert eine fast leere Korrekturliste; 10a dann nicht überschreiben.
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import path from 'node:path'
import { parseCsv } from './xwines.mjs'
import { cleanWineName, fixCaps, nameKey, wineryKey } from './naming.mjs'

const appDir = process.argv[2] ?? '.'
const dry = process.argv.includes('--dry')
const load = (f) => {
  const rows = parseCsv(gunzipSync(readFileSync(path.join(appDir, 'data', f))).toString('utf8'))
  const head = rows.shift()
  return { head, rows: rows.filter((r) => r.length > 1) }
}
const xw = load('katalog.csv.gz')
const off = load('off_katalog.csv.gz')
const ORIG_OFF = off.rows.map((r) => [...r]) // Stand in der Datenbank (für die Umbenennung)
// Spalten: external_id,name,winery,country,region,type,body,acidity,grapes

// Index X-Wines: Weingut-Schlüssel → Namensschlüssel → Weine
const index = new Map()
const add = (idx, r, src) => {
  const wk = wineryKey(r[2])
  const nk = nameKey(r[1], r[2])
  if (!wk || !nk) return
  const k = `${wk}|${nk}`
  idx.set(k, [...(idx.get(k) ?? []), { src, ext: r[0], type: r[5], row: r }])
}
for (const r of xw.rows) add(index, r, 'import')

// 1. Namen bereinigen
let renamed = 0
const renames = []
for (const r of off.rows) {
  const winery = r[2] ? fixCaps(r[2]) : ''
  const name = cleanWineName(r[1], winery)
  if (name !== r[1] || winery !== r[2]) {
    renamed++
    renames.push({ ext: r[0], from: `${r[1]} | ${r[2]}`, name, winery })
    r[1] = name
    r[2] = winery
  }
}

// 2. Dubletten: gleiches Weingut und gleiche Namenswörter (Reihenfolge egal), Typ passt
const typeOk = (a, b) => !a || !b || a === b
const merges = []
const offIndex = new Map()
let ambiguous = 0
const keep = []
for (const r of off.rows) {
  const wk = wineryKey(r[2])
  const nk = nameKey(r[1], r[2])
  const k = `${wk}|${nk}`
  if (wk && nk) {
    const hits = (index.get(k) ?? []).filter((h) => typeOk(h.type, r[5]))
    if (hits.length === 1) {
      merges.push({ from: r[0], intoSrc: 'import', into: hits[0].ext, a: `${r[1]} | ${r[2]}`, b: `${hits[0].row[1]} | ${hits[0].row[2]}` })
      continue
    }
    if (hits.length > 1) ambiguous++
    const dup = (offIndex.get(k) ?? []).find((h) => typeOk(h[5], r[5]))
    if (dup) {
      merges.push({ from: r[0], intoSrc: 'import', into: dup[0], a: `${r[1]} | ${r[2]}`, b: `${dup[1]} | ${dup[2]}` })
      continue
    }
    offIndex.set(k, [...(offIndex.get(k) ?? []), r])
  }
  keep.push(r)
}

console.log({ off: off.rows.length, umbenannt: renamed, zusammengefuehrt: merges.length, mehrdeutig_uebersprungen: ambiguous, bleiben: keep.length })
const sample = (arr, n) => arr.filter((_, i) => i % Math.max(1, Math.floor(arr.length / n)) === 0).slice(0, n)
console.log('Umbenennungen (Stichprobe):')
for (const x of sample(renames, 40)) console.log('  ', x.from, '  →  ', `${x.name} | ${x.winery}`)
console.log('Zusammenführungen (Stichprobe):')
for (const x of sample(merges, 40)) console.log('  ', x.a, '  →  ', x.b)
if (dry) process.exit(0)

// Ausgabe
const esc = (v) => {
  const s = v ?? ''
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
writeFileSync(
  path.join(appDir, 'data/off_katalog.csv.gz'),
  gzipSync(Buffer.from([off.head.join(','), ...keep.map((r) => r.map(esc).join(','))].join('\n') + '\n', 'utf8'), { level: 9 }),
)
const q = (s) => `'${String(s ?? '').replace(/'/g, "''")}'`
const origByExt = new Map(ORIG_OFF.map((r) => [r[0], r]))
const sql = [
  '-- =====================================================================',
  '-- Update 5, Teil A: Korrekturliste für die Open-Food-Facts-Weine (erzeugt von tools/clean-off.mjs).',
  '-- Im Supabase SQL Editor ausführen, danach 10b_namen_dubletten.sql. Kann mehrfach laufen.',
  '-- =====================================================================',
  'create schema if not exists staging;',
  'revoke all on schema staging from public;',
  'drop table if exists staging.off_rename, staging.off_merge;',
  'create table staging.off_rename (external_id text primary key, name text not null, winery text, old_name text not null);',
  'create table staging.off_merge (from_ext text primary key, into_ext text not null);',
  '-- Umbenennungen: external_id, neuer Name, neues Weingut, alter Name (umbenannt wird nur, wenn der Name noch unverändert ist)',
  'insert into staging.off_rename (external_id, name, winery, old_name) values',
  renames.map((x) => `(${q(x.ext)}, ${q(x.name)}, ${x.winery ? q(x.winery) : 'null'}, ${q(origByExt.get(x.ext)[1])})`).join(',\n') + ';',
  '-- Dubletten: Open-Food-Facts-Wein → Zielwein (source, external_id)',
  'insert into staging.off_merge (from_ext, into_ext) values',
  merges.map((x) => `(${q(x.from)}, ${q(x.into)})`).join(',\n') + ';',
  "select (select count(*) from staging.off_rename) as umbenennungen, (select count(*) from staging.off_merge) as dubletten;",
  '',
].join('\n')
writeFileSync(path.join(appDir, 'supabase/10a_katalog_daten.sql'), sql)
console.log('geschrieben: data/off_katalog.csv.gz, supabase/10a_katalog_daten.sql', Math.round(sql.length / 1024), 'KB')
