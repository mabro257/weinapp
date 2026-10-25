// Baut aus der X-Wines-CSV die Importdateien für Supabase:
//   data/katalog.csv.gz      (ein Wein pro Zeile, Rebsorten als kanonische Namen mit | getrennt)
//   data/rebsorten_extra.csv (Rebsorten ohne Glossartext, die im Katalog vorkommen)
import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { loadWines, pyList } from './xwines.mjs'

const [csvFile, appDir] = process.argv.slice(2)
const { GRAPES } = await import(pathToFileURL(path.join(appDir, 'src/lib/grapesData.ts')).href)

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[·\-]/g, ' ').replace(/\s+/g, ' ').trim()

// Glossar-Index: Name und Synonyme -> kanonischer Name; doppelte Einträge melden
const index = new Map()
for (const g of GRAPES) {
  for (const n of [g.name, ...g.synonyms]) {
    const k = norm(n)
    if (index.has(k) && index.get(k) !== g.name) console.warn('DOPPELT:', n, '->', index.get(k), 'und', g.name)
    index.set(k, g.name)
  }
}

function mapGrape(raw) {
  const k = norm(raw)
  if (index.has(k)) return index.get(k)
  for (const part of raw.split('/')) if (index.has(norm(part))) return index.get(norm(part))
  return null
}

const COUNTRY = {
  France: 'Frankreich', Italy: 'Italien', 'United States': 'USA', Spain: 'Spanien', Portugal: 'Portugal', Germany: 'Deutschland',
  Australia: 'Australien', Chile: 'Chile', Argentina: 'Argentinien', 'South Africa': 'Südafrika', Austria: 'Österreich',
  Brazil: 'Brasilien', 'New Zealand': 'Neuseeland', Canada: 'Kanada', Switzerland: 'Schweiz', Greece: 'Griechenland',
  Romania: 'Rumänien', Uruguay: 'Uruguay', Mexico: 'Mexiko', Hungary: 'Ungarn', Israel: 'Israel', Georgia: 'Georgien',
  'Czech Republic': 'Tschechien', Bulgaria: 'Bulgarien', Russia: 'Russland', Croatia: 'Kroatien', Moldova: 'Moldau',
  Slovenia: 'Slowenien', Ukraine: 'Ukraine', 'United Kingdom': 'Großbritannien', Lebanon: 'Libanon', Slovakia: 'Slowakei',
  Turkey: 'Türkei', Serbia: 'Serbien', Luxembourg: 'Luxemburg', China: 'China', Japan: 'Japan', Cyprus: 'Zypern',
  Peru: 'Peru', 'North Macedonia': 'Nordmazedonien', Macedonia: 'Nordmazedonien', Armenia: 'Armenien', Morocco: 'Marokko',
  Belgium: 'Belgien', Netherlands: 'Niederlande', Bolivia: 'Bolivien', Montenegro: 'Montenegro', India: 'Indien',
  'Bosnia and Herzegovina': 'Bosnien und Herzegowina', Denmark: 'Dänemark', Malta: 'Malta', Tunisia: 'Tunesien',
  Albania: 'Albanien', Kazakhstan: 'Kasachstan', Poland: 'Polen', Sweden: 'Schweden', Algeria: 'Algerien', Egypt: 'Ägypten',
}
const TYPE = { Red: 'rot', White: 'weiss', 'Rosé': 'rose', Sparkling: 'schaum' }
const BODY = { 'Very light-bodied': 1, 'Light-bodied': 2, 'Medium-bodied': 3, 'Full-bodied': 4, 'Very full-bodied': 5 }
const ACID = { Low: 2, Medium: 3, High: 4 }

const wines = loadWines(csvFile)
const extra = new Map() // Name -> {rot, weiss}
const unmappedCount = new Map()
let mappedRefs = 0, totalRefs = 0, lugana = 0

const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const lines = ['external_id,name,winery,country,region,type,body,acidity,grapes']

for (const w of wines) {
  const names = []
  for (const raw of pyList(w.Grapes)) {
    totalRefs++
    let canon = mapGrape(raw)
    if (canon) mappedRefs++
    else {
      canon = raw.split('/')[0].trim()
      unmappedCount.set(canon, (unmappedCount.get(canon) ?? 0) + 1)
      const e = extra.get(canon) ?? { rot: 0, weiss: 0 }
      if (w.Type === 'Red' || w.Type === 'Rosé') e.rot++
      else e.weiss++
      extra.set(canon, e)
    }
    if (!names.includes(canon)) names.push(canon)
  }
  // Lugana: X-Wines führt die Turbiana als Verdicchio oder Trebbiano
  if (/lugana/i.test(w.RegionName) || /lugana/i.test(w.WineName)) {
    for (let i = 0; i < names.length; i++) if (names[i] === 'Verdicchio' || names[i] === 'Trebbiano') { names[i] = 'Turbiana'; lugana++ }
  }
  lines.push([
    w.WineID, w.WineName.trim(), w.WineryName.trim(), COUNTRY[w.Country] ?? w.Country, w.RegionName.trim(),
    TYPE[w.Type] ?? '', BODY[w.Body] ?? '', ACID[w.Acidity] ?? '', [...new Set(names)].join('|'),
  ].map(esc).join(','))
}

const out = path.join(appDir, 'data')
mkdirSync(out, { recursive: true })
const csv = lines.join('\n') + '\n'
writeFileSync(path.join(out, 'katalog.csv.gz'), gzipSync(Buffer.from(csv, 'utf8'), { level: 9 }))
const extraLines = ['name,color', ...[...extra.entries()].sort().map(([n, e]) => [n, e.rot >= e.weiss ? 'rot' : 'weiss'].map(esc).join(','))]
writeFileSync(path.join(out, 'rebsorten_extra.csv'), extraLines.join('\n') + '\n')

console.log('Weine:', wines.length, '| CSV MB:', (csv.length / 1e6).toFixed(1))
console.log('Rebsorten-Verweise:', totalRefs, '| davon Glossar:', mappedRefs, `(${((mappedRefs / totalRefs) * 100).toFixed(1)} %)`)
console.log('Rebsorten ohne Glossartext:', extra.size, '| Lugana -> Turbiana:', lugana)
console.log('Häufigste ohne Glossartext:', JSON.stringify([...unmappedCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)))
