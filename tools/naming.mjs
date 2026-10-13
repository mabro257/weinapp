// Namensregeln für Weine (gleiche Logik wie src/lib/naming.ts und public.token_key in 10_namen_dubletten.sql):
// Name = Name des Weins vom Etikett, ohne Weingut und ohne Jahrgang. Weingut steht im eigenen Feld.

export const norm = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Füllwörter, die beim Vergleich nicht zählen (Artikel, Präpositionen, Gattungsbegriffe) */
export const STOP = new Set([
  'de', 'del', 'dei', 'della', 'delle', 'di', 'da', 'du', 'des', 'la', 'le', 'les', 'il', 'lo', 'el', 'los', 'las', 'the', 'and', 'et', 'und', 'y', 'e',
  'doc', 'docg', 'aoc', 'aop', 'igp', 'igt', 'dop', 'do', 'doca', 'qba', 'vdp', 'ac',
  'vin', 'vino', 'vinho', 'wine', 'wein', 'rotwein', 'weisswein', 'rosewein', 'wijn',
])

/** Sortierte, eindeutige Wörter ohne Füllwörter: „Lugana - I Frati / Ca del Frati“ → „ca frati i lugana“ */
export function tokenKey(s) {
  return [...new Set(norm(s).split(' ').filter((t) => t && !STOP.has(t)))].sort().join(' ')
}

const KEEP_UPPER = new Set(['DOC', 'DOCG', 'AOC', 'AOP', 'IGP', 'IGT', 'DOP', 'DO', 'VDP', 'GG', 'QBA', 'USA', 'XO', 'II', 'III', 'IV'])

/** GROSSBUCHSTABEN → normale Schreibweise, Kürzel wie DOC bleiben */
export function fixCaps(s) {
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, '')
  if (letters.length < 4 || letters !== letters.toUpperCase()) return s
  return s
    .split(/(\s+|-|')/)
    .map((w) => (KEEP_UPPER.has(w) || /^([A-Z]\.)+[A-Z]?\.?$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join('')
}

const SEP = /^[\s\-–—,|/:·]+|[\s\-–—,|/:·]+$/g

/** Name bereinigen: Jahrgang und Weingut raus, Großschreibung glätten. Liefert den alten Namen, wenn nichts übrig bliebe. */
export function cleanWineName(name, winery) {
  let n = (name ?? '').replace(/\s+/g, ' ').trim()
  const orig = n
  // Jahrgang (1950–2039) als eigenes Wort
  n = n.replace(/(^|[\s\-–,(])(19[5-9]\d|20[0-3]\d)(?=$|[\s\-–,)])/g, '$1').replace(/\(\s*\)/g, '')
  // Weingut aus dem Namen entfernen (exakt, ohne Rücksicht auf Groß-/Kleinschreibung und Akzente)
  if (winery && winery.trim()) {
    const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const w = fold(winery.trim())
    const f = fold(n)
    const i = f.indexOf(w)
    const wordStart = i === 0 || /[^a-z0-9]/.test(f[i - 1] ?? ' ')
    const wordEnd = i + w.length === f.length || /[^a-z0-9]/.test(f[i + w.length] ?? ' ')
    if (i >= 0 && wordStart && wordEnd) {
      const rest = (n.slice(0, i) + ' ' + n.slice(i + w.length)).replace(/\s*[-–—|,]\s*(?=[-–—|,]|$)/g, ' ')
      if (/[A-Za-zÀ-ÿ]{2,}/.test(rest)) n = rest
    }
  }
  n = n.replace(/\s+([,)])/g, '$1').replace(/\s*[-–—]\s*[-–—]\s*/g, ' - ').replace(/\s+/g, ' ').replace(SEP, '').trim()
  n = fixCaps(n)
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(n)) return fixCaps(orig)
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/** Weingut-Schlüssel: Wörter ohne Füllwörter und ohne Gattungen wie Domaine/Weingut */
const WINERY_GENERIC = new Set(['ca', 'domaine', 'chateau', 'weingut', 'bodega', 'bodegas', 'cantina', 'cantine', 'tenuta', 'azienda', 'agricola', 'cave', 'caves', 'winery', 'estate', 'vineyards', 'wines', 'weinkellerei', 'winzer', 'winzergenossenschaft', 'cooperative', 'maison', 'quinta', 'casa', 'fattoria', 'podere', 'castello', 'clos'])
export function wineryKey(s) {
  return tokenKey(s).split(' ').filter((t) => t && !WINERY_GENERIC.has(t)).join(' ')
}

/** Namensschlüssel ohne die Wörter des Weinguts: „I Frati Lugana“ / „Cà dei Frati“ → „i lugana“ */
export function nameKey(name, winery) {
  const wt = new Set(tokenKey(winery).split(' '))
  return tokenKey(name).split(' ').filter((t) => t && !wt.has(t) && !/^(19|20)\d\d$/.test(t)).join(' ')
}
