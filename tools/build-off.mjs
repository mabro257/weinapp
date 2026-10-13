// Bereitet die Open-Food-Facts-Weine (ODbL) für den Import auf:
// Fehleinträge und namenlose Weine raus, Typ/Land/Rebsorte ableiten, Dubletten zu X-Wines entfernen.
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { parseCsv } from './xwines.mjs'
import { cleanWineName, fixCaps } from './naming.mjs'

const [offFile, appDir] = process.argv.slice(2)
const { GRAPES } = await import(pathToFileURL(path.join(appDir, 'src/lib/grapesData.ts')).href)
const products = Object.values(JSON.parse(readFileSync(offFile, 'utf8')))

const norm = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// Bestehender X-Wines-Katalog für den Dublettenabgleich
const xw = parseCsv(gunzipSync(readFileSync(path.join(appDir, 'data/katalog.csv.gz'))).toString('utf8'))
xw.shift()
const existing = new Set(xw.map((r) => `${norm(r[1])}|${norm(r[2])}`))

const BAD_CAT = /vinegar|jams|sauces|cooking|spreads|biscuits|meals|cheeses|snacks|juices|waters|sodas|beers|spirits|liqueurs|ciders|syrups|confectioner|desserts|teas|coffees|cocktails|aromatized/
const BAD_NAME = /essig|vinaigre|vinagre|aceto|\bsaft\b|juice|\bjus\b|flips|confiture|marmelade|sauce|kochwein|cooking|gluhwein|glühwein|sangria|tinto de verano|vin chaud|bier|biere|cidre|likor|likör|liqueur|schorle|wafer|chips|gelee|senf|moutarde/i
const GENERIC = new Set(['vin rouge', 'vin blanc', 'vin rose', 'rose', 'rotwein', 'weisswein', 'roséwein', 'vino tinto', 'vino blanco', 'vino rosado', 'vino', 'wein', 'red wine', 'white wine', 'vin', 'tinto', 'blanco', 'rouge', 'blanc', 'rosso', 'bianco', 'vin de table', 'vin de france', 'tafelwein', 'landwein', 'qualitatswein'])

const COUNTRY_CAT = [
  [/french-wines|wines-from-france/, 'Frankreich'], [/italian-wines|wines-from-italy/, 'Italien'], [/spanish-wines|wines-from-spain/, 'Spanien'],
  [/german-wines|wines-from-germany/, 'Deutschland'], [/portuguese-wines|wines-from-portugal/, 'Portugal'], [/austrian-wines|wines-from-austria/, 'Österreich'],
  [/swiss-wines|wines-from-switzerland/, 'Schweiz'], [/australian-wines|wines-from-australia/, 'Australien'], [/chilean-wines|wines-from-chile/, 'Chile'],
  [/argentine-wines|argentinian-wines|wines-from-argentina/, 'Argentinien'], [/south-african-wines|wines-from-south-africa/, 'Südafrika'],
  [/american-wines|wines-from-the-united-states|californian-wines/, 'USA'], [/new-zealand-wines|wines-from-new-zealand/, 'Neuseeland'],
  [/greek-wines|wines-from-greece/, 'Griechenland'], [/hungarian-wines|wines-from-hungary/, 'Ungarn'],
]
const ORIGIN = { 'en:france': 'Frankreich', 'en:italy': 'Italien', 'en:spain': 'Spanien', 'en:germany': 'Deutschland', 'en:portugal': 'Portugal', 'en:austria': 'Österreich', 'en:switzerland': 'Schweiz', 'en:australia': 'Australien', 'en:chile': 'Chile', 'en:argentina': 'Argentinien', 'en:south-africa': 'Südafrika', 'en:united-states': 'USA', 'en:new-zealand': 'Neuseeland', 'en:greece': 'Griechenland', 'en:hungary': 'Ungarn' }

// Rebsorten aus dem Namen erkennen (Name und Synonyme als ganze Wörter)
const grapeTerms = []
for (const g of GRAPES) for (const t of [g.name, ...g.synonyms]) {
  const n = norm(t)
  if (n.length >= 4) grapeTerms.push({ re: new RegExp(`\\b${n.replace(/ /g, '\\s+')}\\b`), name: g.name })
}
// Herkunftsbezeichnungen, die praktisch immer eine Rebsorte bedeuten
const APPELLATION = [
  [/\bchablis\b|\bmeursault\b|pouilly fuisse|\bmacon\b/, 'Chardonnay'], [/\bbarolo\b|\bbarbaresco\b|\blanghe nebbiolo\b/, 'Nebbiolo'],
  [/\bchianti\b|vino nobile|\bmorellino\b/, 'Sangiovese'], [/\brioja\b|ribera del duero|\btoro\b/, 'Tempranillo'],
  [/\bsancerre\b|pouilly fume/, 'Sauvignon Blanc'], [/\bbeaujolais\b|\bmorgon\b|\bfleurie\b/, 'Gamay'],
  [/valpolicella|\bamarone\b|\bbardolino\b|\bripasso\b/, 'Corvina'], [/\bsoave\b/, 'Garganega'], [/\bgavi\b/, 'Cortese'],
  [/chateauneuf|cotes du rhone|\bgigondas\b/, 'Grenache'], [/\bmedoc\b|\bpauillac\b|\bmargaux\b/, 'Cabernet Sauvignon'],
  [/saint emilion|st emilion|\bpomerol\b/, 'Merlot'], [/\bcava\b/, 'Macabeo'], [/\bmuscadet\b/, 'Melon de Bourgogne'],
  [/\bvouvray\b/, 'Chenin Blanc'], [/\bvinho verde\b/, 'Loureiro'], [/\btokaj/, 'Furmint'], [/\bprosecco\b/, 'Glera'],
]

function typeOf(cats, n) {
  const has = (re) => cats.some((c) => re.test(c))
  if (has(/^en:(sparkling-wines|champagnes|proseccos|cavas|cremants|sekts?)$/) || /\b(sekt|prosecco|champagne|cava|cremant|spumante|brut|frizzante|secco)\b/.test(n)) return 'schaum'
  if (has(/^en:rose-wines$/) || /\b(rose|rosato|rosado|weissherbst)\b/.test(n)) return 'rose'
  if (has(/^en:red-wines$/) || /\b(rouge|rosso|tinto|rotwein|red)\b/.test(n)) return 'rot'
  if (has(/^en:white-wines$/) || /\b(blanc|bianco|blanco|weisswein|white)\b/.test(n)) return 'weiss'
  return ''
}

const titleCase = (s) => (s === s.toLowerCase() ? s.replace(/(^|[\s\-'])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase()) : s)
const cleanName = (s) => titleCase(s.replace(/\s*\b\d+([.,]\d+)?\s*(cl|ml|l|ltr|liter)\b\.?/gi, '').replace(/\s+/g, ' ').trim())

const seen = new Set()
const reasons = { ohneName: 0, fremd: 0, generisch: 0, dublette: 0 }
const lines = ['external_id,name,winery,country,region,type,body,acidity,grapes']
const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
let withGrape = 0
for (const p of products) {
  const raw = (p.product_name_de || p.product_name || p.product_name_fr || p.product_name_it || '').trim()
  const cats = p.categories_tags ?? []
  if (raw.length < 3) { reasons.ohneName++; continue }
  if (cats.some((c) => BAD_CAT.test(c)) || BAD_NAME.test(raw)) { reasons.fremd++; continue }
  // Namensregel: ohne Weingut und Jahrgang (naming.mjs)
  const winery = fixCaps(titleCase((p.brands ?? '').split(',')[0].trim()))
  const name = cleanWineName(cleanName(raw), winery)
  // Nur aussagekräftige Einträge: kein reiner Gattungsname, ohne Weingut mindestens drei Wörter
  if (GENERIC.has(norm(name)) || (!winery && norm(name).split(' ').length < 3)) { reasons.generisch++; continue }
  const key = `${norm(name)}|${norm(winery)}`
  if (existing.has(key) || seen.has(key)) { reasons.dublette++; continue }
  seen.add(key)
  const n = norm(`${name} ${p.generic_name ?? ''}`)
  const found = grapeTerms.map((t) => ({ name: t.name, i: n.search(t.re) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i).map((x) => x.name)
  let grapes = [...new Set(found)]
  if (!grapes.length) for (const [re, g] of APPELLATION) if (re.test(n)) { grapes = [g]; break }
  if (grapes.length) withGrape++
  const country = COUNTRY_CAT.find(([re]) => cats.some((c) => re.test(c)))?.[1] ?? (p.origins_tags ?? []).map((o) => ORIGIN[o]).find(Boolean) ?? ''
  lines.push(['off:' + p.code, name, winery, country, '', typeOf(cats, n), '', '', grapes.join('|')].map(esc).join(','))
}
writeFileSync(path.join(appDir, 'data/off_katalog.csv.gz'), gzipSync(Buffer.from(lines.join('\n') + '\n', 'utf8'), { level: 9 }))
console.log('OFF-Produkte:', products.length, '| übernommen:', lines.length - 1, '| mit Rebsorte:', withGrape, '| aussortiert:', JSON.stringify(reasons))
console.log('Beispiele:', JSON.stringify(lines.slice(1, 16)))
