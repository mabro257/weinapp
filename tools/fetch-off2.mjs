// Open Food Facts liefert pro Suchanfrage höchstens 1.000 Treffer.
// Deshalb in Teilmengen abfragen (Weinart x Verkaufsland) und nach Barcode zusammenführen.
import { writeFileSync, existsSync, readFileSync } from 'node:fs'

const OUT = process.argv[2]
const FIELDS = 'code,product_name,product_name_de,product_name_fr,product_name_it,generic_name,brands,categories_tags,origins,origins_tags,countries_tags,labels_tags,quantity'
const UA = 'WeinApp-Katalogimport/0.1 (privates, nichtkommerzielles Projekt)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const all = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}

const KINDS = ['red-wines', 'white-wines', 'rose-wines', 'sparkling-wines', 'champagnes', 'fortified-wines', 'sweet-wines', 'wines-from-france', 'wines-from-italy', 'wines-from-spain', 'german-wines', 'wines']
const COUNTRIES = ['', 'france', 'germany', 'italy', 'spain', 'switzerland', 'belgium', 'united-kingdom', 'netherlands', 'austria', 'portugal']

async function get(url) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (res.ok) return await res.json()
      if (res.status === 401 || res.status === 400) return { end: true }
    } catch {}
    await sleep(10000 * attempt)
  }
  return null
}

for (const kind of KINDS) {
  for (const country of COUNTRIES) {
    let added = 0, count = 0
    for (let page = 1; page <= 10; page++) {
      const url = `https://world.openfoodfacts.org/api/v2/search?categories_tags_en=${kind}${country ? `&countries_tags_en=${country}` : ''}&page_size=100&page=${page}&fields=${FIELDS}`
      const data = await get(url)
      await sleep(6500)
      if (!data || data.end) break
      count = data.count
      for (const p of data.products ?? []) if (p.code && !all[p.code]) { all[p.code] = p; added++ }
      if (!data.products?.length || page * 100 >= data.count) break
    }
    writeFileSync(OUT, JSON.stringify(all))
    console.log(`${kind} / ${country || 'alle'}: ${count} Treffer, neu ${added}, gesamt ${Object.keys(all).length}`)
  }
}
console.log('Fertig:', Object.keys(all).length)
