import type { CommunityStats, Grape, GrapeCommunity, RatingWithWine, Wine } from './types'
import { mean, quantileInc, summarize } from './stats'

/**
 * Decider: regelbasierter Score.
 *
 * Bausteine (jeweils als erwartete Punktzahl auf der 100er-Skala):
 *  - Rebsorte (Gewicht 45 %): deine Bewertungen der Hauptrebsorte
 *  - Region (20 %): deine Bewertungen aus derselben Region
 *  - Geschmack (15 %): Nähe zu Körper und Säure deiner besten Weine
 *  - Freunde (20 %, sekundär): Community-Schnitt des Weins bzw. der Rebsorte
 * Wenige Bewertungen werden zu deinem Gesamtschnitt hin „gedämpft“ (Shrinkage),
 * damit ein einzelner Ausreißer nicht die Empfehlung bestimmt.
 * Fehlt ein Baustein, werden die übrigen Gewichte hochgerechnet.
 */
export interface Candidate {
  key: string
  label: string
  sub: string
  wine: Wine | null
  grapeId: number | null
}

export interface DeciderResult {
  key: string
  label: string
  sub: string
  score: number
  reasons: string[]
  confidence: 'hoch' | 'mittel' | 'niedrig'
  /** wichtigster Grund in Satzform, z. B. „du kennst ihn schon und gibst ihm im Schnitt 91“ */
  driver: string
}

/** Einordnung der Entscheidung in ein, zwei Sätzen */
export function explain(results: DeciderResult[]): string {
  if (results.length < 2) return ''
  const [top, second] = results
  const last = results[results.length - 1]
  const gap = top.score - second.score
  const parts: string[] = []
  if (gap >= 5) parts.push(`Klare Sache: ${top.label} passt deutlich besser zu dir als ${second.label}, denn ${top.driver}.`)
  else if (gap >= 2) parts.push(`${top.label} liegt knapp vor ${second.label}, denn ${top.driver}.`)
  else parts.push(`Knappe Entscheidung: ${top.label} und ${second.label} passen fast gleich gut. Wähle nach Lust und Laune.`)
  if (results.length >= 3 && top.score - last.score >= 6) parts.push(`Am wenigsten passt ${last.label}.`)
  if (top.confidence === 'niedrig') parts.push('Die Einschätzung ist noch unsicher, weil dir dazu eigene Bewertungen fehlen.')
  return parts.join(' ')
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
    let driver = ''

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
        if (comm && comm.count >= 3) {
          reasons.push(`Deine Gruppen: ${name} im Schnitt ${Math.round(comm.avg)} (${comm.count} Bewertungen).`)
          driver = `${name} kommt in deinen Gruppen gut an (Ø ${Math.round(comm.avg)})`
        }
      } else {
        const s = summarize(scores)
        if (s.kind === 'box') {
          const spread =
            s.iqr <= 4
              ? `, sehr verlässlich (${Math.round(s.q1)} bis ${Math.round(s.q3)})`
              : s.iqr >= 7
                ? `, aber mal so, mal so (${s.min} bis ${s.max})`
                : ''
          reasons.push(`${name}: bei dir meist ${Math.round(s.median)} (${s.n} Bewertungen)${spread}.`)
        } else {
          reasons.push(`${name}: erst ${s.n} eigene ${s.n === 1 ? 'Bewertung' : 'Bewertungen'} (Ø ${Math.round(mean(scores)!)}).`)
        }
        const typical = s.kind === 'box' ? s.median : mean(scores)!
        driver =
          typical >= overall + 1
            ? `${name} gefällt dir meist besser als dein Durchschnitt (typisch ${Math.round(typical)})`
            : typical <= overall - 2
              ? `bei ${name} bist du eher kritisch (typisch ${Math.round(typical)}), die anderen liegen aber noch darunter`
              : `${name} liegt bei dir im soliden Mittelfeld (typisch ${Math.round(typical)})`
      }
    }

    const region = c.wine?.region
    if (region) {
      const scores = mine.filter((r) => r.region === region).map((r) => r.score)
      if (scores.length) {
        parts.push({ w: W.region, v: shrunk(scores, overall) })
        evidence += scores.length
        reasons.push(`${region}: Ø ${Math.round(mean(scores)!)} aus ${scores.length} ${scores.length === 1 ? 'Bewertung' : 'Bewertungen'}.`)
        if (!driver && mean(scores)! >= overall) driver = `Weine aus ${region} gefallen dir (Ø ${Math.round(mean(scores)!)})`
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
    if (own.length) {
      reasons.unshift(`Kennst du schon: deine Ø ${Math.round(mean(own)!)} aus ${own.length}×.`)
      driver = `du kennst ihn schon und gibst ihm im Schnitt ${Math.round(mean(own)!)}`
    }
    if (!driver && wc && wc.count > 0) driver = `er kommt in deinen Gruppen gut an (Ø ${Math.round(wc.avg)})`
    if (!driver) driver = 'er passt am ehesten zu deinem bisherigen Geschmack'

    if (!c.wine && grapeId === null) reasons.push('Ohne Rebsorte oder Katalogeintrag kaum einschätzbar.')
    else if (!c.wine) reasons.push('Nur die Rebsorte ist bekannt, daher nur grob einschätzbar.')

    const totalW = parts.reduce((a, p) => a + p.w, 0)
    const score = totalW ? parts.reduce((a, p) => a + p.w * p.v, 0) / totalW : overall
    const confidence = evidence >= 8 ? 'hoch' : evidence >= 3 ? 'mittel' : 'niedrig'
    return { key: c.key, label: c.label, sub: c.sub, score: Math.round(score), reasons, confidence, driver }
  })

  return results.sort((a, b) => b.score - a.score)
}
