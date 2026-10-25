// Liest die X-Wines-CSV ein (RFC-4180-Parser) und stellt Hilfsfunktionen bereit.
import { readFileSync } from 'node:fs'

export function parseCsv(text) {
  const rows = []
  let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else q = false
      } else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

/** "['A', 'B']" -> ['A', 'B'] */
export function pyList(s) {
  const out = []
  const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g
  let m
  while ((m = re.exec(s))) out.push((m[1] ?? m[2]).replace(/\\'/g, "'"))
  return out
}

export function loadWines(file) {
  const rows = parseCsv(readFileSync(file, 'utf8'))
  const head = rows.shift()
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}

if (process.argv[2] === 'stats') {
  const wines = loadWines(process.argv[3])
  console.log('Weine:', wines.length)
  const count = (key, fn = (w) => [w[key]]) => {
    const m = new Map()
    for (const w of wines) for (const v of fn(w)) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  console.log('Typen:', JSON.stringify(count('Type')))
  console.log('Body:', JSON.stringify(count('Body')))
  console.log('Acidity:', JSON.stringify(count('Acidity')))
  console.log('Länder (Top 30):', JSON.stringify(count('Country').slice(0, 30)))
  const grapes = count('Grapes', (w) => pyList(w.Grapes))
  console.log('Rebsorten gesamt:', grapes.length)
  console.log('Rebsorten Top 250:', JSON.stringify(grapes.slice(0, 250)))
  const lug = wines.filter((w) => /lugana/i.test(w.WineName) || /lugana/i.test(w.RegionName))
  console.log('Lugana-Treffer:', lug.length, JSON.stringify(lug.slice(0, 5).map((w) => [w.WineName, w.Grapes, w.RegionName, w.WineryName])))
}
