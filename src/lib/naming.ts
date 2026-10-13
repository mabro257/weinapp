/**
 * Namensregel für Weine (gleiche Logik wie tools/naming.mjs und public.token_key):
 * Name = Name des Weins vom Etikett, ohne Weingut und ohne Jahrgang.
 * Weingut, Rebsorten, Region und Jahrgang haben eigene Felder.
 */

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s: string) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim()

const STOP = new Set([
  'de', 'del', 'dei', 'della', 'delle', 'di', 'da', 'du', 'des', 'la', 'le', 'les', 'il', 'lo', 'el', 'los', 'las', 'the', 'and', 'et', 'und', 'y', 'e',
  'doc', 'docg', 'aoc', 'aop', 'igp', 'igt', 'dop', 'do', 'doca', 'qba', 'vdp', 'ac',
  'vin', 'vino', 'vinho', 'wine', 'wein', 'rotwein', 'weisswein', 'rosewein', 'wijn',
  'trocken', 'dry',
])

/** Zahlen als Wort: „III“ = „3“ = „drei“ (wie public.token_key) */
const NUM: Record<string, string> = {
  1: 'eins', 2: 'zwei', 3: 'drei', 4: 'vier', 5: 'funf', 6: 'sechs', 7: 'sieben', 8: 'acht', 9: 'neun', 10: 'zehn', 11: 'elf', 12: 'zwolf',
  ii: 'zwei', iii: 'drei', iv: 'vier', vi: 'sechs', vii: 'sieben', viii: 'acht', ix: 'neun', xi: 'elf', xii: 'zwolf',
}
const tok = (t: string) => NUM[t] ?? t

/** Sortierte Wörter ohne Füllwörter, Reihenfolge egal: „Lugana - I Frati“ = „I Frati Lugana“ */
export function tokenKey(s: string): string {
  return [...new Set(norm(s).split(' ').filter((t) => t && !STOP.has(t)).map(tok))].sort().join(' ')
}

const WINERY_GENERIC = new Set([
  'ca', 'domaine', 'chateau', 'weingut', 'bodega', 'bodegas', 'cantina', 'cantine', 'tenuta', 'azienda', 'agricola',
  'cave', 'caves', 'winery', 'estate', 'vineyards', 'wines', 'weinkellerei', 'winzer', 'winzergenossenschaft',
  'cooperative', 'maison', 'quinta', 'casa', 'fattoria', 'podere', 'castello', 'clos',
])
const words = (k: string) => k.split(' ').filter(Boolean)

/** Anteil gemeinsamer Wörter (Dice), 0–1 */
function dice(a: string, b: string): number {
  const x = new Set(words(a))
  const y = new Set(words(b))
  if (!x.size || !y.size) return 0
  return (2 * [...x].filter((t) => y.has(t)).length) / (x.size + y.size)
}

/** Trigramm-Ähnlichkeit wie pg_trgm (vereinfacht), 0–1 */
function trigram(a: string, b: string): number {
  const grams = (s: string) => {
    const out = new Set<string>()
    for (const w of words(s)) {
      const p = `  ${w} `
      for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3))
    }
    return out
  }
  const x = grams(a)
  const y = grams(b)
  if (!x.size || !y.size) return 0
  const common = [...x].filter((g) => y.has(g)).length
  return common / (x.size + y.size - common)
}

/**
 * Ähnlichkeit zweier Weine wie public.wine_similarity, 0–1:
 * Weinname ohne Weingut-Wörter zählt 70 %, Weingut 30 %.
 */
export function wineSimilarity(aName: string, aWinery: string | null, bName: string, bWinery: string | null): number {
  const wt = new Set(words(tokenKey(`${aWinery ?? ''} ${bWinery ?? ''}`)))
  const minus = (k: string) => words(k).filter((t) => !wt.has(t)).join(' ')
  const na = minus(tokenKey(aName))
  const nb = minus(tokenKey(bName))
  const wk = (w: string | null) => words(tokenKey(w ?? '')).filter((t) => t.length > 1 && !WINERY_GENERIC.has(t)).join(' ')
  const wa = wk(aWinery)
  const wb = wk(bWinery)
  const nameSim = na === nb ? 1 : Math.max(dice(na, nb), 0.8 * trigram(na, nb))
  const winSim = !wa || !wb ? 0.5 : Math.max(dice(wa, wb), trigram(wa, wb))
  const s = 0.7 * nameSim + 0.3 * winSim
  // Passen beide Weingüter klar nicht zusammen, ist es kein Duplikat
  return wa && wb && winSim < 0.6 ? Math.min(s, 0.6) : s
}

/** ab dieser Ähnlichkeit gilt ein Paar als mögliche Dublette (wie duplicate_candidates) */
export const DUPLICATE_MIN = 0.92

const VINTAGE = /(^|[\s\-–,(])((?:19[5-9]|20[0-3])\d)(?=$|[\s\-–,)])/

const KEEP_UPPER = new Set(['DOC', 'DOCG', 'AOC', 'AOP', 'IGP', 'IGT', 'DOP', 'DO', 'VDP', 'GG', 'QBA', 'XO', 'II', 'III', 'IV'])
function fixCaps(s: string): string {
  return s
    .split(/(\s+|-|')/)
    .map((w) => (KEEP_UPPER.has(w) || /^([A-Z]\.)+[A-Z]?\.?$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join('')
}
const tidy = (s: string) =>
  s.replace(/\s+([,)])/g, '$1').replace(/\s*[-–—]\s*[-–—]\s*/g, ' - ').replace(/\s+/g, ' ').replace(/^[\s\-–—,|/:·]+|[\s\-–—,|/:·]+$/g, '').trim()

export interface NameIssue {
  key: 'jahrgang' | 'weingut' | 'gross'
  text: string
  /** Vorschlag für den korrigierten Namen */
  fix: string
}

/**
 * Name ohne Weingut, oder null, wenn das Weingut nicht im Namen steht.
 * Erkennt auch andere Schreibweisen: „DREI FREUNDE Rosé“ bei Weingut „III Freunde“, „Probestein Riesling“ bei „Weingut Probestein“.
 */
function stripWinery(n: string, w: string): string | null {
  const hasText = (s: string) => /[A-Za-zÀ-ÿ]{2,}/.test(s)
  // 1. wörtlich enthalten
  const f = fold(n)
  const i = f.indexOf(fold(w))
  const startOk = i === 0 || /[^a-z0-9]/.test(f[i - 1] ?? ' ')
  const endOk = i + w.length >= f.length || /[^a-z0-9]/.test(f[i + w.length] ?? ' ')
  if (i >= 0 && startOk && endOk) {
    const fix = tidy(n.slice(0, i) + ' ' + n.slice(i + w.length))
    return hasText(fix) ? fix : null
  }
  // 2. alle kennzeichnenden Wörter des Weinguts kommen im Namen vor (Zahlen als Wort, ohne Domaine/Weingut …)
  const all = new Set(words(tokenKey(w)))
  const key = [...all].filter((t) => !WINERY_GENERIC.has(t))
  if (!key.length) return null
  const parts = n.split(/\s+/)
  const partKey = (p: string) => tok(norm(p))
  const nameKeys = new Set(parts.map(partKey))
  if (!key.every((t) => nameKeys.has(t))) return null
  const fix = tidy(parts.filter((p) => !all.has(partKey(p))).join(' '))
  return hasText(fix) ? fix : null
}

/** Name nach der Regel bereinigt (alle Korrekturen auf einmal), oder null, wenn alles passt */
export function suggestName(name: string, winery: string): string | null {
  let n = name.trim()
  for (let i = 0; i < 3; i++) {
    const issue = nameIssues(n, winery)[0]
    if (!issue) break
    n = issue.fix
  }
  return n && n !== name.trim() ? n : null
}

/** Prüft einen Weinnamen gegen die Namensregel und schlägt Korrekturen vor. */
export function nameIssues(name: string, winery: string): NameIssue[] {
  const n = name.trim()
  if (!n) return []
  const out: NameIssue[] = []
  const v = n.match(VINTAGE)
  if (v) {
    const fix = tidy(n.replace(VINTAGE, '$1'))
    if (fix) out.push({ key: 'jahrgang', text: `Der Jahrgang ${v[2]} gehört in die Bewertung, nicht in den Namen. So zählen alle Jahrgänge zum selben Wein.`, fix })
  }
  const w = winery.trim()
  if (w.length >= 3) {
    const fix = stripWinery(n, w)
    if (fix) out.push({ key: 'weingut', text: 'Das Weingut steht schon im eigenen Feld und muss nicht in den Namen.', fix })
  }
  const letters = n.replace(/[^A-Za-zÀ-ÿ]/g, '')
  if (letters.length >= 4 && letters === letters.toUpperCase()) {
    out.push({ key: 'gross', text: 'Bitte normal schreiben statt in Großbuchstaben, dann sieht die Liste einheitlich aus.', fix: fixCaps(n) })
  }
  return out
}
