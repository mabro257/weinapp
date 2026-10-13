/** Kleinbuchstaben ohne Akzente, damit „Cotes“ auch „Côtes“ findet. */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

const NUMBERS: Record<string, string> = {
  1: 'eins', 2: 'zwei', 3: 'drei', 4: 'vier', 5: 'funf', 6: 'sechs', 7: 'sieben', 8: 'acht', 9: 'neun', 10: 'zehn', 11: 'elf', 12: 'zwolf',
}
const ROMAN: Record<string, string> = {
  ii: 'zwei', iii: 'drei', iv: 'vier', vi: 'sechs', vii: 'sieben', viii: 'acht', ix: 'neun', xi: 'elf', xii: 'zwolf',
}

/** Wie `num_words` in der Datenbank: hinter Ziffer 1–12 bzw. römischer Zahl steht das Zahlwort („iii freunde“ → „iii drei freunde“). */
export function numWords(normalized: string): string {
  return normalized.replace(/(?<![\p{L}\p{N}_])([0-9]+|[ivx]+)(?![\p{L}\p{N}_])/gu, (m) => {
    const w = NUMBERS[m] ?? ROMAN[m]
    return w ? `${m} ${w}` : m
  })
}

/** Suchwörter wie in `search_wines`: Ziffern 1–12 werden zum Zahlwort („3 freunde“ → „drei freunde“). */
export function searchTokens(query: string): string[] {
  return normalize(query).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean).map((t) => NUMBERS[t] ?? t)
}

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const MONTHS_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/** 2026-08-12 → 12. Aug 2026 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${String(d).padStart(2, '0')}. ${MONTHS[m - 1]} ${y}`
}

/** 2026-08-12 → August 2026 */
export function formatMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS_LONG[m - 1]} ${y}`
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function scoreWord(s: number): string {
  if (s >= 95) return 'außergewöhnlich'
  if (s >= 90) return 'hervorragend'
  if (s >= 85) return 'sehr gut'
  if (s >= 80) return 'gut'
  if (s >= 70) return 'ordentlich'
  if (s >= 50) return 'schwach'
  return 'mangelhaft'
}

export const TASTE = {
  body: { label: 'Körper', low: 'leicht', high: 'kräftig', words: ['sehr leicht', 'leicht', 'mittel', 'kräftig', 'sehr kräftig'] },
  acidity: { label: 'Säure', low: 'mild', high: 'frisch', words: ['sehr mild', 'mild', 'mittel', 'frisch', 'sehr frisch'] },
  tannin: { label: 'Tannin', low: 'weich', high: 'kräftig', words: ['sehr weich', 'weich', 'mittel', 'kräftig', 'sehr kräftig'] },
} as const

export type TasteKey = keyof typeof TASTE

export function tasteWord(key: TasteKey, v: number | null): string {
  if (!v) return 'nicht angegeben'
  return TASTE[key].words[Math.min(5, Math.max(1, Math.round(v))) - 1]
}

export const PRICE_LABEL = ['', '€', '€€', '€€€', '€€€€']
