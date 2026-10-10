/**
 * Boxplot-Kennzahlen.
 * Quartile: inklusive Methode mit linearer Interpolation (wie Excel QUARTILE.INC).
 * Unter 5 Werten: nur Einzelpunkte. 5 bis 9 Werte: Linien von Minimum bis Maximum.
 * Ab 10 Werten: Linien nach Tukey (bis 1,5 × IQR), Werte darüber hinaus als Ausreißer.
 */
export const MIN_FOR_BOX = 5
export const MIN_FOR_TUKEY = 10

export function quantileInc(sorted: number[], p: number): number {
  if (!sorted.length) return NaN
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export type BoxSummary =
  | { kind: 'dots'; n: number; values: number[]; median: number | null }
  | {
      kind: 'box'
      n: number
      q1: number
      median: number
      q3: number
      iqr: number
      whiskerLow: number
      whiskerHigh: number
      min: number
      max: number
      outliers: number[]
    }

export function summarize(values: number[]): BoxSummary {
  const s = [...values].sort((a, b) => a - b)
  if (s.length < MIN_FOR_BOX) {
    return { kind: 'dots', n: s.length, values: s, median: s.length ? quantileInc(s, 0.5) : null }
  }
  const q1 = quantileInc(s, 0.25)
  const median = quantileInc(s, 0.5)
  const q3 = quantileInc(s, 0.75)
  const iqr = q3 - q1
  let whiskerLow = s[0]
  let whiskerHigh = s[s.length - 1]
  let outliers: number[] = []
  if (s.length >= MIN_FOR_TUKEY) {
    const lowFence = q1 - 1.5 * iqr
    const highFence = q3 + 1.5 * iqr
    const inside = s.filter((v) => v >= lowFence && v <= highFence)
    whiskerLow = inside[0]
    whiskerHigh = inside[inside.length - 1]
    outliers = s.filter((v) => v < lowFence || v > highFence)
  }
  return { kind: 'box', n: s.length, q1, median, q3, iqr, whiskerLow, whiskerHigh, min: s[0], max: s[s.length - 1], outliers }
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

export function round(v: number): string {
  return String(Math.round(v))
}
