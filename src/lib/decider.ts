import type { CommunityStats, Grape, GrapeCommunity, RatingWithWine, Wine } from './types'
import { mean, quantileInc, summarize } from './stats'

/**
 * Restaurant-Decider: regelbasierter Score.
 *
 * Bausteine (jeweils als erwartete Punktzahl auf der 100er-Skala):
 *  - Rebsorte (Gewicht 45 %): deine Bewertungen der Hauptrebsorte
 *  - Region (20 %): deine Bewertungen aus derselben Region
 *  - Geschmack (15 %): Nähe zu Körper und Säure deiner besten Weine
 *  - Freunde (20 %, sekundär): Community-Schnitt des Weins bzw. der Rebsorte
 * Wenige Bewertungen werden zu deinem Gesamtschnitt hin „gedämpft“ (Shrinkage),
 * damit ein einzelner Ausreißer nicht die Empfehlung bestimmt.
 * Fehlt ein Baustein, werden die übrigen Gewichte hochgerechnet.
 * Der Preis fließt bewusst nicht ein.
 */
export interface Candidate {
  key: string
  label: string
  sub: string
  wine: Wine | null
  grapeId: number | null
  price: string
}

export interface DeciderResult {
  key: string
  label: string
  sub: string
  score: number
  reasons: string[]
  confidence: 'hoch' | 'mittel' | 'niedrig'
}

const SHRINK = 3
const W = { grape: 0.45, region: 0.2, taste: 0.15, community: 0.2 }

function shrunk(values: number[], prior: number, k = SHRINK) {
  const m = mean(values)
  if (m === null) return prior
  return (values.length * m + k * prior) / (values.length + k)
}

export function decide(
  candidates: Candidate[],
  mine: RatingWithWine[],
  grapes: Grape[],
  grapeComm: GrapeCommunity[],
  wineComm: Map<number, CommunityStats>,
): DeciderResult[] {
  const all = mine.map((r) => r.score)
  const overall = mean(all) ?? 85
  const grapeName = (id: number | null) => grapes.find((g) => g.id === id)?.name ?? 'Unbekannt'

  // Bevorzugtes Profil: Durchschnitt aus Körper/Säure deiner überdurchschnittlichen Weine
  const sortedAll = [...all].sort((a, b) => a - b)
  const median = sortedAll.length ? quantileInc(sortedAll, 0.5) : overall
  const good = mine.filter((r) => r.score >= median)
  const prefBody = mean(good.flatMap((r) => (r.body ? [r.body] : [])))
  const prefAcid = mean(good.flatMap((r) => (r.acidity ? [r.acidity] : [])))

  const results = candidates.map((c): DeciderResult => {
    const parts: { w: number; v: number }[] = []
    const reasons: string[] = []
    let evidence = 0

    const grapeId = c.wine?.grapeIds[0] ?? c.grapeId
    if (grapeId !== null && grapeId !== undefined) {
      const scores = mine.filter((r) => r.mainGrapeId === grapeId).map((r) => r.score)
      const comm = grapeComm.find((g) => g.grapeId === grapeId)
      const prior = comm && comm.count >= 3 ? comm.avg : overall
      parts.push({ w: W.grape, v: shrunk(scores, prior) })
      evidence += scores.length
      const name = grapeName(grapeId)
      if (scores.length === 0) {
        reasons.push(`${name}: noch keine eigene Bewertung.`)
        if (comm && comm.count >= 3) reasons.push(`Deine Gruppen: ${name} im Schnitt ${Math.round(comm.avg)} (${comm.count} Bewertungen).`)
      } else {
        const s = summarize(scores)
        if (s.kind === 'box') {
          const spread =
            s.iqr <= 4
              ? `, sehr konstant (${Math.round(s.q1)} bis ${Math.round(s.q3)})`
              : s.iqr >= 7
                ? `, aber stark schwankend (${s.min} bis ${s.max})`
                : ''
          reasons.push(`${name}: dein Median ${Math.round(s.median)} aus ${s.n} Bewertungen${spread}.`)
        } else {
          reasons.push(`${name}: erst ${s.n} eigene ${s.n === 1 ? 'Bewertung' : 'Bewertungen'} (Ø ${Math.round(mean(scores)!)}).`)
        }
      }
    }

    const region = c.wine?.region
    if (region) {
      const scores = mine.filter((r) => r.region === region).map((r) => r.score)
      if (scores.length) {
        parts.push({ w: W.region, v: shrunk(scores, overall) })
        evidence += scores.length
        reasons.push(`${region}: Ø ${Math.round(mean(scores)!)} aus ${scores.length} ${scores.length === 1 ? 'Bewertung' : 'Bewertungen'}.`)
      }
    }

    const wb = c.wine?.body
    const wa = c.wine?.acidity
    if (wb && wa && prefBody !== null && prefAcid !== null) {
      const d = Math.abs(prefBody - wb) + Math.abs(prefAcid - wa)
      parts.push({ w: W.taste, v: overall + (2 - d) * 1.5 })
      if (d <= 1.5) reasons.push('Körper und Säure passen zu den Weinen, die du am höchsten bewertest.')
      else if (d >= 3) reasons.push('Körper und Säure weichen von deinen Lieblingsweinen ab.')
    }

    const wc = c.wine ? wineComm.get(c.wine.id) : undefined
    if (wc && wc.count > 0) {
      parts.push({ w: W.community, v: shrunk(Array(wc.count).fill(wc.avg), overall, 2) })
      reasons.push(`Deine Gruppen: dieser Wein im Schnitt ${Math.round(wc.avg)} (${wc.count} ${wc.count === 1 ? 'Bewertung' : 'Bewertungen'}).`)
    }

    const own = c.wine ? mine.filter((r) => r.wineId === c.wine!.id).map((r) => r.score) : []
    if (own.length) reasons.unshift(`Kennst du schon: deine Ø ${Math.round(mean(own)!)} aus ${own.length}×.`)

    if (!c.wine && grapeId === null) reasons.push('Ohne Rebsorte oder Katalogeintrag kaum einschätzbar.')
    else if (!c.wine) reasons.push('Nur die Rebsorte ist bekannt, daher nur grob einschätzbar.')

    const totalW = parts.reduce((a, p) => a + p.w, 0)
    const score = totalW ? parts.reduce((a, p) => a + p.w * p.v, 0) / totalW : overall
    const confidence = evidence >= 8 ? 'hoch' : evidence >= 3 ? 'mittel' : 'niedrig'
    return { key: c.key, label: c.label, sub: c.sub, score: Math.round(score), reasons, confidence }
  })

  return results.sort((a, b) => b.score - a.score)
}
