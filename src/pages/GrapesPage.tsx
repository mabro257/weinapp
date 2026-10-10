import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { summarize, type BoxSummary } from '../lib/stats'
import { normalize } from '../lib/text'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { AxisLabels, Boxplot, Card, CardTitle, ErrorBox, Hint, Page, PageTitle } from '../components/ui'

export default function GrapesPage() {
  const { grapes } = useApp()
  const mine = useAsync(() => api.myRatings(), [])
  const [q, setQ] = useState('')

  const stats = useMemo(() => {
    const by = new Map<number, number[]>()
    for (const r of mine.data ?? []) {
      if (r.mainGrapeId === null) continue
      by.set(r.mainGrapeId, [...(by.get(r.mainGrapeId) ?? []), r.score])
    }
    return new Map([...by.entries()].map(([id, xs]) => [id, summarize(xs)] as [number, BoxSummary]))
  }, [mine.data])

  const rows = [...stats.entries()]
    .map(([id, s]) => ({ grape: grapes.find((g) => g.id === id), s }))
    .filter((r) => r.grape)
    .sort((a, b) => {
      const ma = a.s.kind === 'box' ? a.s.median : a.s.median ?? 0
      const mb = b.s.kind === 'box' ? b.s.median : b.s.median ?? 0
      // Boxplots vor Einzelpunkten, dann nach Median
      if (a.s.kind !== b.s.kind) return a.s.kind === 'box' ? -1 : 1
      return mb - ma
    })

  // Verlässlichster Treffer: hoher Median, geringe Streuung
  const best = rows
    .filter((r) => r.s.kind === 'box')
    .map((r) => ({ ...r, value: r.s.kind === 'box' ? r.s.median - 0.5 * r.s.iqr : 0 }))
    .sort((a, b) => b.value - a.value)[0]

  const nq = normalize(q)
  // Ohne Suche nur Rebsorten mit Glossartext oder eigenen Bewertungen; seltene Sorten aus dem Katalog erst bei Suche
  const az = grapes
    .filter((g) => (nq ? normalize([g.name, ...g.synonyms].join(' ')).includes(nq) : g.short !== null || stats.has(g.id)))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const hiddenCount = nq ? 0 : grapes.length - az.length

  return (
    <Page>
      <PageTitle title="Rebsorten" sub="Wie zuverlässig trifft eine Rebsorte deinen Geschmack?" />
      {mine.error && <ErrorBox message={mine.error} />}

      <div className="flex flex-col gap-4 px-4 pt-5">
        {best && best.s.kind === 'box' && best.grape && (
          <Link to={`/rebsorten/${best.grape.id}`} className="flex flex-col gap-1.5 rounded-[28px] bg-hero p-5 text-white no-underline">
            <span className="text-[13px] font-bold opacity-90">Dein verlässlichster Treffer</span>
            <span className="text-2xl font-extrabold">{best.grape.name}</span>
            <span className="text-sm leading-normal opacity-95">
              Median {Math.round(best.s.median)}. Die mittlere Hälfte deiner Bewertungen liegt zwischen {Math.round(best.s.q1)} und {Math.round(best.s.q3)}.
            </span>
          </Link>
        )}

        <Card className="flex flex-col gap-3.5">
          <CardTitle right={<Hint>nach Median</Hint>}>Meine Verteilung</CardTitle>
          {rows.length === 0 && <div className="text-sm text-muted">Sobald du Weine mit Rebsorte bewertest, erscheint hier deine Verteilung.</div>}
          {rows.map(({ grape, s }) => (
            <Link
              key={grape!.id}
              to={`/rebsorten/${grape!.id}`}
              aria-label={
                s.kind === 'box'
                  ? `${grape!.name}: ${s.n} Bewertungen, Median ${Math.round(s.median)}, mittlere Hälfte ${Math.round(s.q1)} bis ${Math.round(s.q3)}`
                  : `${grape!.name}: ${s.n} Bewertungen: ${s.values.join(', ')}`
              }
              className="flex min-h-11 items-center gap-2.5 text-ink no-underline"
            >
              <span className="flex w-[120px] flex-none flex-col gap-px">
                <span className="truncate text-sm font-bold">{grape!.name}</span>
                <span className="text-xs text-muted">
                  {s.n} Bew. · {s.kind === 'box' ? `Median ${Math.round(s.median)}` : 'zu wenig'}
                </span>
              </span>
              <Boxplot s={s} />
            </Link>
          ))}
          {rows.length > 0 && (
            <div className="flex gap-2.5">
              <span className="w-[120px] flex-none" />
              <AxisLabels />
            </div>
          )}
          <div className="rounded-[18px] bg-chip px-3.5 py-3 text-xs leading-normal text-ink-2">
            Box: mittlere Hälfte deiner Bewertungen. Strich: Median. Linien: Spannweite. Offener Punkt: Ausreißer (ab 10 Bewertungen). Unter 5 Bewertungen siehst du nur Einzelpunkte.
          </div>
        </Card>

        <Card className="pb-1">
          <h2 className="m-0 mb-1 text-lg font-bold">Alle Rebsorten</h2>
          <p className="m-0 mb-3 text-[13px] leading-snug text-muted">
            {grapes.length} Rebsorten im Katalog.
            {hiddenCount > 0 && ` Seltene Sorten ohne Glossartext (${hiddenCount}) findest du über die Suche.`}
          </p>
          <label htmlFor="rsuche" className="sr-only">Rebsorte suchen</label>
          <input id="rsuche" type="search" placeholder="Rebsorte suchen, auch Synonyme" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2 h-12 w-full rounded-full border-0 bg-chip px-[18px] text-base outline-none" />
          {az.map((g) => {
            const n = stats.get(g.id)?.n ?? 0
            return (
              <Link key={g.id} to={`/rebsorten/${g.id}`} className="flex min-h-11 items-center justify-between gap-3 border-t border-line py-3.5 text-ink no-underline">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{g.name}</span>
                  {g.synonyms.length > 0 && <span className="truncate text-xs text-muted">auch: {g.synonyms.join(', ')}</span>}
                </span>
                <span className="flex-none text-[13px] font-semibold text-muted">{n === 0 ? 'noch keine' : `${n} ${n === 1 ? 'Bewertung' : 'Bewertungen'}`}</span>
              </Link>
            )
          })}
        </Card>
      </div>
    </Page>
  )
}
