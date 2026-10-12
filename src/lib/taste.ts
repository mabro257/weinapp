import type { Grape, RatingWithWine } from './types'
import { mean, quantileInc, summarize, type BoxSummary } from './stats'

/**
 * Stilgruppen: fassen die vielen Rebsorten zu wenigen verständlichen Gruppen zusammen,
 * abgeleitet aus Körper, Säure und Tannin im Glossar.
 */
const AROMATIC = new Set(['Muskateller', 'Gewürztraminer', 'Sauvignon Blanc', 'Scheurebe', 'Torrontés', 'Viognier', 'Bacchus', "Muscat d'Alexandrie", 'Kerner', 'Müller-Thurgau'])

export const STYLE_ORDER: Record<'rot' | 'weiss', string[]> = {
  weiss: ['Leicht & frisch', 'Aromatisch & duftig', 'Mittel & mineralisch', 'Kräftig & cremig'],
  rot: ['Leicht & fruchtig', 'Mittel & saftig', 'Kräftig & würzig', 'Kraftvoll & tanninreich'],
}

export function styleOf(g: Grape): string | null {
  if (!g.body) return null
  if (g.color === 'weiss') {
    if (AROMATIC.has(g.name)) return 'Aromatisch & duftig'
    if (g.body <= 2) return 'Leicht & frisch'
    if (g.body === 3) return 'Mittel & mineralisch'
    return 'Kräftig & cremig'
  }
  if (g.body <= 2) return 'Leicht & fruchtig'
  if (g.body === 3) return 'Mittel & saftig'
  if ((g.tannin ?? 0) >= 5) return 'Kraftvoll & tanninreich'
  return 'Kräftig & würzig'
}

export interface Profile {
  body: number | null
  acidity: number | null
  tannin: number | null
  favorites: number
  threshold: number
}

/** Geschmacksprofil einer Bewertung: eigene Angabe, sonst Tendenz der Hauptrebsorte */
function ratingProfile(r: RatingWithWine, byId: Map<number, Grape>) {
  const g = r.mainGrapeId !== null ? byId.get(r.mainGrapeId) : undefined
  return {
    body: r.body ?? g?.body ?? null,
    acidity: r.acidity ?? g?.acidity ?? null,
    tannin: r.tannin ?? g?.tannin ?? null,
    color: g?.color ?? null,
  }
}

/** Bevorzugtes Profil: Durchschnitt der Weine, die mindestens deinen Median erreichen */
export function preference(mine: RatingWithWine[], grapes: Grape[], color?: 'rot' | 'weiss'): Profile {
  const byId = new Map(grapes.map((g) => [g.id, g]))
  const scores = [...mine.map((r) => r.score)].sort((a, b) => a - b)
  const threshold = scores.length ? quantileInc(scores, 0.5) : 0
  const fav = mine
    .filter((r) => r.score >= threshold)
    .map((r) => ratingProfile(r, byId))
    .filter((p) => !color || p.color === color)
  const pick = (k: 'body' | 'acidity' | 'tannin') => mean(fav.flatMap((p) => (p[k] ? [p[k] as number] : [])))
  return { body: pick('body'), acidity: pick('acidity'), tannin: pick('tannin'), favorites: fav.length, threshold }
}

export interface Cell {
  body: number
  acidity: number
  grapes: Grape[]
  myScores: number[]
}

/** Matrix Körper (1–5) x Säure (1–5) für eine Weinfarbe */
export function matrix(mine: RatingWithWine[], grapes: Grape[], color: 'rot' | 'weiss'): Cell[][] {
  const rows: Cell[][] = []
  for (let a = 5; a >= 1; a--) {
    const row: Cell[] = []
    for (let b = 1; b <= 5; b++) row.push({ body: b, acidity: a, grapes: [], myScores: [] })
    rows.push(row)
  }
  const cell = (b: number, a: number) => rows[5 - a][b - 1]
  const byId = new Map(grapes.map((g) => [g.id, g]))
  for (const g of grapes) {
    if (g.color !== color || !g.body || !g.acidity || !g.short) continue
    cell(g.body, g.acidity).grapes.push(g)
  }
  for (const r of mine) {
    const g = r.mainGrapeId !== null ? byId.get(r.mainGrapeId) : undefined
    if (!g || g.color !== color || !g.body || !g.acidity) continue
    cell(g.body, g.acidity).myScores.push(r.score)
  }
  return rows
}

export interface Recommendation {
  grape: Grape
  reason: string
  distance: number
}

/** Rebsorten, die du noch nicht bewertet hast und die deinem Profil am nächsten liegen */
export function recommendations(mine: RatingWithWine[], grapes: Grape[], limit = 6): Recommendation[] {
  const tried = new Map<number, number[]>()
  for (const r of mine) if (r.mainGrapeId !== null) tried.set(r.mainGrapeId, [...(tried.get(r.mainGrapeId) ?? []), r.score])
  const overall = mean(mine.map((r) => r.score)) ?? 85
  // Lieblingsrebsorten: mindestens dein Durchschnitt
  const liked = grapes.filter((g) => {
    const s = tried.get(g.id)
    return s && s.length && (mean(s) ?? 0) >= overall && g.body && g.acidity
  })
  if (!liked.length) return []
  const dist = (a: Grape, b: Grape) =>
    Math.abs((a.body ?? 3) - (b.body ?? 3)) + Math.abs((a.acidity ?? 3) - (b.acidity ?? 3)) + 0.7 * Math.abs((a.tannin ?? 1) - (b.tannin ?? 1))
  const out: Recommendation[] = []
  for (const g of grapes) {
    if (tried.has(g.id) || !g.short || !g.body || !g.acidity) continue
    let best: Grape | null = null
    let bestD = Infinity
    for (const l of liked) {
      if (l.color !== g.color) continue
      const d = dist(g, l)
      if (d < bestD) {
        bestD = d
        best = l
      }
    }
    if (best && bestD <= 2) out.push({ grape: g, distance: bestD, reason: `ähnliches Profil wie ${best.name}, die du magst` })
  }
  return out.sort((a, b) => a.distance - b.distance || a.grape.name.localeCompare(b.grape.name, 'de')).slice(0, limit)
}

export interface GrapeRow {
  key: string
  id: number | null
  name: string
  s: BoxSummary
}

/** Verteilung je Rebsorte; seltene Sorten ohne Glossartext werden zu „Weitere …" zusammengefasst */
export function distribution(mine: RatingWithWine[], grapes: Grape[]): GrapeRow[] {
  const byId = new Map(grapes.map((g) => [g.id, g]))
  const groups = new Map<string, { id: number | null; name: string; xs: number[] }>()
  for (const r of mine) {
    if (r.mainGrapeId === null) continue
    const g = byId.get(r.mainGrapeId)
    if (!g) continue
    const key = g.short ? `g${g.id}` : `rest-${g.color}`
    const name = g.short ? g.name : g.color === 'rot' ? 'Weitere rote Sorten' : 'Weitere weiße Sorten'
    const cur = groups.get(key) ?? { id: g.short ? g.id : null, name, xs: [] }
    cur.xs.push(r.score)
    groups.set(key, cur)
  }
  return [...groups.entries()]
    .map(([key, v]) => ({ key, id: v.id, name: v.name, s: summarize(v.xs) }))
    .sort((a, b) => {
      if (a.s.kind !== b.s.kind) return a.s.kind === 'box' ? -1 : 1
      const ma = a.s.kind === 'box' ? a.s.median : a.s.median ?? 0
      const mb = b.s.kind === 'box' ? b.s.median : b.s.median ?? 0
      return mb - ma
    })
}
