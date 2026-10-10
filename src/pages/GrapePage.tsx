import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { mean, summarize } from '../lib/stats'
import { TASTE, type TasteKey } from '../lib/text'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { AxisLabels, Boxplot, Card, ErrorBox, HeroBack, Page, ScoreBadge } from '../components/ui'

export default function GrapePage() {
  const id = Number(useParams().id)
  const { grapes } = useApp()
  const grape = grapes.find((g) => g.id === id)
  const mine = useAsync(() => api.myRatings(), [])

  const data = useMemo(() => {
    const rs = (mine.data ?? []).filter((r) => r.mainGrapeId === id)
    const byWine = new Map<number, { name: string; winery: string | null; scores: number[] }>()
    for (const r of rs) {
      const cur = byWine.get(r.wineId) ?? { name: r.wineName, winery: r.winery, scores: [] }
      cur.scores.push(r.score)
      byWine.set(r.wineId, cur)
    }
    const wines = [...byWine.entries()]
      .map(([wineId, w]) => ({ wineId, ...w, avg: Math.round(mean(w.scores)!) }))
      .sort((a, b) => b.avg - a.avg)
    return { s: rs.length ? summarize(rs.map((r) => r.score)) : null, wines }
  }, [mine.data, id])

  if (!grape) return <Page><ErrorBox message="Rebsorte nicht gefunden." /></Page>
  const s = data.s

  let verdict = ''
  if (s?.kind === 'box') {
    verdict =
      s.iqr <= 4
        ? `Die mittlere Hälfte deiner Bewertungen liegt zwischen ${Math.round(s.q1)} und ${Math.round(s.q3)}. Das ist eng: ${grape.name} trifft deinen Geschmack sehr zuverlässig.`
        : s.iqr >= 7
          ? `Die mittlere Hälfte deiner Bewertungen reicht von ${Math.round(s.q1)} bis ${Math.round(s.q3)}. Bei ${grape.name} schwankt es stark, es kommt sehr auf den einzelnen Wein an.`
          : `Die mittlere Hälfte deiner Bewertungen liegt zwischen ${Math.round(s.q1)} und ${Math.round(s.q3)}.`
  } else if (s) {
    verdict = `Erst ${s.n} ${s.n === 1 ? 'Bewertung' : 'Bewertungen'}. Ab 5 Bewertungen zeigt die App einen Boxplot.`
  }

  return (
    <Page>
      <div className="flex flex-col gap-3 rounded-b-[36px] bg-hero px-5 pt-5 pb-[72px] text-white">
        <div className="mb-3">
          <HeroBack />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-[13px] font-semibold">{grape.color === 'rot' ? 'Rot' : 'Weiß'}</span>
        </div>
        <h1 className="m-0 text-[32px] leading-[1.1] font-extrabold">{grape.name}</h1>
        {grape.synonyms.length > 0 && <div className="text-[15px] font-medium opacity-90">auch: {grape.synonyms.join(', ')}</div>}
      </div>

      <div className="relative -mt-12 flex flex-col gap-4 px-4">
        <Card className="flex flex-col gap-[18px]">
          {!s ? (
            <div className="text-sm text-muted">Du hast noch keinen {grape.name} bewertet.</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[26px] font-extrabold text-berry">{s.kind === 'box' ? Math.round(s.median) : s.median === null ? '–' : Math.round(s.median)}</span>
                  <span className="text-xs font-semibold text-muted">Median</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[26px] font-extrabold">{s.n}</span>
                  <span className="text-xs font-semibold text-muted">Bewertungen</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[26px] font-extrabold">{s.kind === 'box' ? `${s.min}–${s.max}` : `${s.values[0]}–${s.values[s.values.length - 1]}`}</span>
                  <span className="text-xs font-semibold text-muted">Spanne</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="rounded-xl bg-chip px-1 py-1.5">
                  <Boxplot s={s} height={36} />
                </div>
                <AxisLabels />
              </div>
              <div className="text-[13px] leading-normal text-ink-2">{verdict}</div>
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="m-0 text-lg font-bold">Kurzprofil</h2>
          {grape.short && <p className="m-0 text-[15px] leading-relaxed">{grape.short}</p>}
          {grape.aromas.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-[13px] font-bold text-muted">Typische Aromen</div>
              <div className="flex flex-wrap gap-2">
                {grape.aromas.map((a) => (
                  <span key={a} className="rounded-full bg-rose-badge px-3 py-1.5 text-[13px] font-semibold text-berry-dark">{a}</span>
                ))}
              </div>
            </div>
          )}
          {grape.regions && (
            <div className="flex flex-col gap-2">
              <div className="text-[13px] font-bold text-muted">Typische Regionen</div>
              <div className="text-[15px] leading-normal">{grape.regions}</div>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <div className="text-[13px] font-bold text-muted">Stil (Tendenz)</div>
            {(['body', 'acidity', 'tannin'] as TasteKey[]).map((k) => {
              const v = grape[k]
              if (!v) return null
              return (
                <div key={k} className="flex items-center gap-3" aria-label={`${TASTE[k].label}: ${v} von 5`}>
                  <span className="w-16 flex-none text-sm font-semibold">{TASTE[k].label}</span>
                  <span className="grid flex-1 grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-2.5 rounded-full ${n <= v ? 'bg-berry' : 'bg-rose'}`} />
                    ))}
                  </span>
                </div>
              )
            })}
          </div>
          {grape.food && (
            <div className="flex flex-col gap-2">
              <div className="text-[13px] font-bold text-muted">Passt zu</div>
              <div className="text-[15px] leading-normal">{grape.food}</div>
            </div>
          )}
        </Card>

        {data.wines.length > 0 && (
          <Card className="pb-1">
            <h2 className="m-0 mb-3 text-lg font-bold">Meine {grape.name}-Weine</h2>
            {data.wines.map((w) => (
              <Link key={w.wineId} to={`/wein/${w.wineId}`} className="flex items-center gap-3.5 border-t border-line py-3.5 text-ink no-underline">
                <ScoreBadge score={w.avg} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="text-[15px] font-bold">{w.name}</div>
                  <div className="truncate text-[13px] text-muted">
                    {[w.winery, `${w.scores.length} ${w.scores.length === 1 ? 'Verkostung' : 'Verkostungen'}`].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </Page>
  )
}
