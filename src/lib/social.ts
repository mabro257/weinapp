import type { CommunityStats, Friend, FriendRating, Grape, GrapeCommunity, RatingWithWine } from './types'
import { decide, type Candidate } from './decider'
import { mean } from './stats'
import { preference } from './taste'

// ---------------------------------------------------------------------
// Geschmackszwilling
// ---------------------------------------------------------------------

export const MIN_COMMON = 5

export interface Twin {
  friend: Friend
  common: number
  meanDiff: number | null
  /** Übereinstimmung in Prozent, erst ab MIN_COMMON gemeinsamen Weinen */
  match: number | null
  profile: { body: number | null; acidity: number | null; tannin: number | null }
  /** Weine, die der Freund hoch bewertet und du noch nicht kennst */
  tips: { wineId: number; name: string; winery: string | null; score: number }[]
  /** gemeinsamer Wein mit der größten Abweichung */
  disagree: { wineId: number; name: string; winery: string | null; mine: number; theirs: number } | null
}

function avgByWine(rs: RatingWithWine[]) {
  const m = new Map<number, { name: string; winery: string | null; scores: number[] }>()
  for (const r of rs) {
    const cur = m.get(r.wineId) ?? { name: r.wineName, winery: r.winery, scores: [] }
    cur.scores.push(r.score)
    m.set(r.wineId, cur)
  }
  return new Map([...m].map(([id, v]) => [id, { name: v.name, winery: v.winery, avg: mean(v.scores)! }]))
}

export function twins(mine: RatingWithWine[], friendRatings: FriendRating[], friends: Friend[], grapes: Grape[]): Twin[] {
  const myWines = avgByWine(mine)
  const myPref = preference(mine, grapes)
  return friends
    .map((friend): Twin => {
      const theirs = friendRatings.filter((r) => r.userId === friend.userId)
      const theirWines = avgByWine(theirs)
      const diffs: { wineId: number; name: string; winery: string | null; mine: number; theirs: number }[] = []
      for (const [id, t] of theirWines) {
        const m = myWines.get(id)
        if (m) diffs.push({ wineId: id, name: t.name, winery: t.winery, mine: Math.round(m.avg), theirs: Math.round(t.avg) })
      }
      const meanDiff = diffs.length ? mean(diffs.map((d) => Math.abs(d.mine - d.theirs)))! : null
      const profile = preference(theirs, grapes)
      let match: number | null = null
      if (meanDiff !== null && diffs.length >= MIN_COMMON) {
        const scoreSim = Math.max(0, Math.min(100, 100 - 4 * meanDiff))
        const parts = (['body', 'acidity', 'tannin'] as const).flatMap((k) =>
          myPref[k] !== null && profile[k] !== null ? [Math.abs((myPref[k] as number) - (profile[k] as number))] : [],
        )
        const profileSim = parts.length ? Math.max(0, Math.min(100, 100 - 15 * parts.reduce((a, b) => a + b, 0))) : null
        match = Math.round(profileSim === null ? scoreSim : 0.75 * scoreSim + 0.25 * profileSim)
      }
      const tips = [...theirWines]
        .filter(([id, t]) => !myWines.has(id) && t.avg >= 88)
        .sort((a, b) => b[1].avg - a[1].avg)
        .slice(0, 5)
        .map(([id, t]) => ({ wineId: id, name: t.name, winery: t.winery, score: Math.round(t.avg) }))
      const disagree = diffs.length ? [...diffs].sort((a, b) => Math.abs(b.mine - b.theirs) - Math.abs(a.mine - a.theirs))[0] : null
      return {
        friend,
        common: diffs.length,
        meanDiff,
        match,
        profile: { body: profile.body, acidity: profile.acidity, tannin: profile.tannin },
        tips,
        disagree: disagree && Math.abs(disagree.mine - disagree.theirs) >= 5 ? disagree : null,
      }
    })
    .sort((a, b) => (b.match ?? -1) - (a.match ?? -1) || b.common - a.common)
}

// ---------------------------------------------------------------------
// Gruppen-Decider
// ---------------------------------------------------------------------

export interface TablePerson {
  id: string
  name: string
  ratings: RatingWithWine[]
}

export interface TableResult {
  key: string
  label: string
  sub: string
  score: number
  perPerson: { id: string; name: string; score: number }[]
  weakest: { name: string; score: number } | null
}

/** Passung je Person über den normalen Decider, Tischwert = Schnitt, abgewertet bei einem Ausreißer nach unten */
export function decideForTable(
  candidates: Candidate[],
  people: TablePerson[],
  grapes: Grape[],
  grapeComm: GrapeCommunity[],
  wineComm: Map<number, CommunityStats>,
): TableResult[] {
  const perPerson = people.map((p) => ({ p, res: decide(candidates, p.ratings, grapes, grapeComm, wineComm) }))
  return candidates
    .map((c): TableResult => {
      const scores = perPerson.map(({ p, res }) => ({ id: p.id, name: p.name, score: res.find((r) => r.key === c.key)?.score ?? 0 }))
      const avg = mean(scores.map((s) => s.score)) ?? 0
      const min = Math.min(...scores.map((s) => s.score))
      const weakest = scores.find((s) => s.score === min) ?? null
      return {
        key: c.key,
        label: c.label,
        sub: c.sub,
        score: Math.round(avg - 0.5 * (avg - min)),
        perPerson: scores,
        weakest: weakest && scores.length > 1 && avg - min >= 4 ? { name: weakest.name, score: weakest.score } : null,
      }
    })
    .sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------
// Abzeichen
// ---------------------------------------------------------------------

export interface BadgeInput {
  mine: RatingWithWine[]
  grapes: Grape[]
  hostedTastings: number
  joinedTastings: number
  sentRecommendations: number
  hitRecommendations: number
  bestMatch: number | null
}

export interface Badge {
  name: string
  desc: string
  have: number
  need: number
}

export function badges(i: BadgeInput): Badge[] {
  const byId = new Map(i.grapes.map((g) => [g.id, g]))
  const grapesTried = new Set(i.mine.flatMap((r) => (r.mainGrapeId !== null && byId.has(r.mainGrapeId) ? [r.mainGrapeId] : []))).size
  const countries = new Set(i.mine.flatMap((r) => (r.country ? [r.country] : []))).size
  const regions = new Set(i.mine.flatMap((r) => (r.region ? [r.region] : []))).size
  const notes = i.mine.filter((r) => r.note && r.note.trim().length > 0).length
  return [
    { name: 'Erster Schluck', desc: 'Erste Bewertung', have: Math.min(i.mine.length, 1), need: 1 },
    { name: 'Stammgast', desc: '10 Bewertungen', have: Math.min(i.mine.length, 10), need: 10 },
    { name: 'Kenner', desc: '50 Bewertungen', have: Math.min(i.mine.length, 50), need: 50 },
    { name: 'Sortensammler', desc: '10 Rebsorten', have: Math.min(grapesTried, 10), need: 10 },
    { name: 'Weltreise', desc: '5 Länder', have: Math.min(countries, 5), need: 5 },
    { name: 'Regionenkenner', desc: '10 Regionen', have: Math.min(regions, 10), need: 10 },
    { name: 'Gesellige Runde', desc: 'Bei einem Weinabend bewertet', have: Math.min(i.joinedTastings, 1), need: 1 },
    { name: 'Gastgeber', desc: 'Weinabend ausgerichtet', have: Math.min(i.hostedTastings, 1), need: 1 },
    { name: 'Tippgeber', desc: '3 Weine empfohlen', have: Math.min(i.sentRecommendations, 3), need: 3 },
    { name: 'Volltreffer', desc: 'Empfehlung bekam 90+', have: Math.min(i.hitRecommendations, 1), need: 1 },
    { name: 'Zwilling', desc: '80 % Match gefunden', have: i.bestMatch !== null && i.bestMatch >= 80 ? 1 : 0, need: 1 },
    { name: 'Notizbuch', desc: '20 Bewertungen mit Notiz', have: Math.min(notes, 20), need: 20 },
  ]
}
