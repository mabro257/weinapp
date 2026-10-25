import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { mean, quantileInc } from '../lib/stats'
import { PRICE_LABEL, PRICE_RANGE, TASTE, tasteWord, type TasteKey } from '../lib/text'
import { distribution, matrix, preference, priceValue, recommendations, styleOf, topWines } from '../lib/taste'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { AxisLabels, Boxplot, Card, CardTitle, ErrorBox, Hint, Loading, Page, PageTitle, ScoreBadge, Segmented, TasteBar } from '../components/ui'
import { IconBook, IconNext } from '../components/Icons'

/** Farbe einer Matrix-Zelle nach deiner Durchschnittsnote */
function cellColor(avg: number | null, hasGrapes: boolean) {
  if (avg === null) return { bg: hasGrapes ? '#F4F2F7' : '#FFFFFF', fg: '#4A4455' }
  if (avg >= 91) return { bg: '#8E2A4B', fg: '#FFFFFF' }
  if (avg >= 88) return { bg: '#B5577A', fg: '#FFFFFF' }
  if (avg >= 85) return { bg: '#D9A3B4', fg: '#1E1B24' }
  return { bg: '#F1DCE3', fg: '#1E1B24' }
}

export default function TastePage() {
  const { grapes } = useApp()
  const res = useAsync(async () => {
    const [mine, friends] = await Promise.all([api.myRatings(), api.friendRatings().catch(() => [])])
    return { mine, friends }
  }, [])
  const [color, setColor] = useState<'rot' | 'weiss'>('weiss')
  const [selected, setSelected] = useState<string | null>(null)
  const mine = useMemo(() => res.data?.mine ?? [], [res.data])

  const data = useMemo(() => {
    const pref = preference(mine, grapes, color)
    // Konkrete Tipps zu den vorgeschlagenen Rebsorten: Weine, die Freunde mögen und du noch nicht kennst
    const known = new Set(mine.map((r) => r.wineId))
    const friendTip = new Map<number, { wineId: number; name: string; avg: number }>()
    const byWine = new Map<number, { name: string; grape: number | null; scores: number[] }>()
    for (const r of res.data?.friends ?? []) {
      if (known.has(r.wineId)) continue
      const cur = byWine.get(r.wineId) ?? { name: r.wineName, grape: r.mainGrapeId, scores: [] }
      cur.scores.push(r.score)
      byWine.set(r.wineId, cur)
    }
    for (const [wineId, w] of byWine) {
      const avg = w.scores.reduce((a, b) => a + b, 0) / w.scores.length
      if (w.grape === null || avg < 85) continue
      const best = friendTip.get(w.grape)
      if (!best || avg > best.avg) friendTip.set(w.grape, { wineId, name: w.name, avg })
    }
    const rows = distribution(mine, grapes)
    const topGrapes = rows.filter((r) => r.id !== null && r.s.n >= 2).slice(0, 3)
    const byRegion = new Map<string, number[]>()
    for (const r of mine) if (r.region) byRegion.set(r.region, [...(byRegion.get(r.region) ?? []), r.score])
    const topRegions = [...byRegion.entries()]
      .filter(([, xs]) => xs.length >= 2)
      .map(([name, xs]) => ({ name, median: quantileInc([...xs].sort((a, b) => a - b), 0.5), n: xs.length }))
      .sort((a, b) => b.median - a.median)
      .slice(0, 3)
    const byId = new Map(grapes.map((g) => [g.id, g]))
    const reds = mine.filter((r) => r.mainGrapeId !== null && byId.get(r.mainGrapeId)?.color === 'rot').length
    const whites = mine.filter((r) => r.mainGrapeId !== null && byId.get(r.mainGrapeId)?.color === 'weiss').length
    return { pref, rows, topGrapes, topRegions, reds, whites, recs: recommendations(mine, grapes), friendTip, cells: matrix(mine, grapes, color), top: topWines(mine), value: priceValue(mine) }
  }, [mine, grapes, color, res.data])

  if (res.loading && !res.data) return <Page><Loading /></Page>

  const sel = selected ? data.cells.flat().find((c) => `${c.body}-${c.acidity}` === selected) : undefined
  const total = data.reds + data.whites

  return (
    <Page>
      <PageTitle title="Mein Geschmack" sub="Was dir schmeckt und was du als Nächstes probieren solltest" />
      {res.error && <ErrorBox message={res.error} />}

      <div className="flex flex-col gap-4 px-4 pt-5">
        {mine.length < 3 ? (
          <Card>
            <div className="text-sm leading-normal text-ink-2">Bewerte ein paar Weine, dann entsteht hier dein Geschmacksprofil.</div>
          </Card>
        ) : (
          <Card className="flex flex-col gap-[18px]">
            <CardTitle right={<Hint>Skala 1–5</Hint>}>Dein Profil</CardTitle>
            <Segmented label="Weinfarbe" value={color} onChange={(v) => { if (v) { setColor(v); setSelected(null) } }} options={[{ value: 'weiss', label: 'Weiß' }, { value: 'rot', label: 'Rot' }]} />
            {data.pref.favorites === 0 ? (
              <div className="text-[13px] text-muted">Noch keine Lieblingsweine in {color === 'rot' ? 'Rot' : 'Weiß'}.</div>
            ) : (
              <>
                {((color === 'rot' ? ['body', 'acidity', 'tannin'] : ['body', 'acidity']) as TasteKey[]).map((k) =>
                  data.pref[k] === null ? null : <TasteBar key={k} label={TASTE[k].label} word={tasteWord(k, data.pref[k])} mine={data.pref[k]} community={null} />,
                )}
                <div className="text-[13px] leading-normal text-muted">
                  So sind deine Lieblingsweine in {color === 'rot' ? 'Rot' : 'Weiß'} (ab Note {Math.round(data.pref.threshold)}).
                </div>
              </>
            )}
            {total > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="text-[13px] font-bold text-muted">Rot oder Weiß</div>
                <div className="flex h-3 overflow-hidden rounded-full bg-chip" role="img" aria-label={`Rot ${Math.round((data.reds / total) * 100)} Prozent, Weiß ${Math.round((data.whites / total) * 100)} Prozent`}>
                  <div className="bg-hero" style={{ width: `${(data.reds / total) * 100}%` }} />
                  <div style={{ width: `${(data.whites / total) * 100}%`, background: '#E7D9A2' }} />
                </div>
                <div className="flex justify-between text-xs font-semibold text-ink-2">
                  <span>Rot {Math.round((data.reds / total) * 100)} %</span>
                  <span>Weiß {Math.round((data.whites / total) * 100)} %</span>
                </div>
              </div>
            )}
            {data.topGrapes.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[13px] font-bold text-muted">Deine Top-Rebsorten</div>
                <div className="flex flex-wrap gap-2">
                  {data.topGrapes.map((g) => (
                    <Link key={g.key} to={`/rebsorten/${g.id}`} className="rounded-full bg-rose-badge px-3 py-1.5 text-[13px] font-bold text-berry-dark no-underline">
                      {g.name} · {Math.round(g.s.kind === 'box' ? g.s.median : g.s.median ?? 0)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {data.topRegions.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[13px] font-bold text-muted">Deine Top-Regionen</div>
                <div className="flex flex-wrap gap-2">
                  {data.topRegions.map((r) => (
                    <span key={r.name} className="rounded-full bg-chip px-3 py-1.5 text-[13px] font-semibold text-ink-2">
                      {r.name} · {Math.round(r.median)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {data.top.length > 0 && (
          <Card className="pb-1">
            <CardTitle right={<Hint>Ø je Wein</Hint>}>Meine Top 5</CardTitle>
            <div className="pt-2">
              {data.top.map((w, i) => (
                <Link key={w.wineId} to={`/wein/${w.wineId}`} className="flex min-h-11 items-center gap-3.5 border-t border-line py-3 text-ink no-underline">
                  <span className="w-4 flex-none text-center text-sm font-extrabold text-muted">{i + 1}</span>
                  <ScoreBadge score={Math.round(w.avg)} size={44} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{w.name}</span>
                    <span className="truncate text-[13px] text-muted">{[w.winery, w.n > 1 ? `${w.n} Bewertungen` : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  <IconNext size={18} className="flex-none text-muted" />
                </Link>
              ))}
            </div>
          </Card>
        )}

        {mine.length > 0 && (
          <Card className="flex flex-col gap-3.5">
            <CardTitle right={<Hint>Ø je Wein</Hint>}>Preis-Leistung</CardTitle>
            {data.value.classes.some((c) => c.wines > 0) ? (
              <>
                <div className="flex flex-col gap-2.5">
                  {data.value.classes.map((c) => (
                    <div key={c.cls} className="flex items-center gap-2.5">
                      <span className="flex w-[92px] flex-none flex-col">
                        <span className="text-sm font-extrabold">{PRICE_LABEL[c.cls]}</span>
                        <span className="text-[11px] text-muted">{PRICE_RANGE[c.cls]}</span>
                      </span>
                      <span className="relative h-3 flex-1 rounded-full bg-chip">
                        {c.avg !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-berry" style={{ width: `${Math.max(4, Math.min(100, ((c.avg - 70) / 30) * 100))}%` }} />}
                      </span>
                      <span className="flex w-[56px] flex-none flex-col items-end">
                        {c.avg !== null ? <b className="text-[15px] font-extrabold">{Math.round(c.avg)}</b> : <span className="text-muted">–</span>}
                        <span className="text-[11px] text-muted">{c.wines} {c.wines === 1 ? 'Wein' : 'Weine'}</span>
                      </span>
                    </div>
                  ))}
                </div>
                {data.value.premium !== null && (
                  <div className="rounded-[18px] bg-chip px-3.5 py-3 text-[13px] leading-snug text-ink-2">
                    {Math.abs(data.value.premium) < 1
                      ? 'Weine ab 10 € gefallen dir im Schnitt nicht besser als günstigere. Der Aufpreis lohnt sich für dich kaum.'
                      : data.value.premium > 0
                        ? `Weine ab 10 € bewertest du im Schnitt ${Math.round(data.value.premium)} ${Math.round(data.value.premium) === 1 ? 'Punkt' : 'Punkte'} besser als günstigere.`
                        : `Überraschung: Weine bis 10 € bewertest du im Schnitt ${Math.round(-data.value.premium)} ${Math.round(-data.value.premium) === 1 ? 'Punkt' : 'Punkte'} besser als teurere.`}
                  </div>
                )}
                {data.value.bargains.length > 0 && (
                  <div className="flex flex-col">
                    <div className="text-[13px] font-bold text-muted">Gut und günstig (bis 10 €)</div>
                    {data.value.bargains.map((w) => (
                      <Link key={w.wineId} to={`/wein/${w.wineId}`} className="flex min-h-11 items-center gap-3 border-t border-line py-2.5 text-ink no-underline first:border-t-0">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[15px] font-bold">{w.name}</span>
                          <span className="truncate text-[13px] text-muted">{[w.winery, PRICE_LABEL[w.cls]].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className="flex-none text-lg font-extrabold text-berry">{Math.round(w.avg)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm leading-normal text-ink-2">Noch keine Preisklassen hinterlegt. Trag sie auf der Weinseite ein.</div>
            )}
            {data.value.withoutPrice > 0 && data.value.classes.some((c) => c.wines > 0) && (
              <div className="text-xs leading-normal text-muted">
                {data.value.withoutPrice} {data.value.withoutPrice === 1 ? 'Wein' : 'Weine'} ohne Preisklasse
              </div>
            )}
          </Card>
        )}

        {mine.length > 0 && (
        <Card className="flex flex-col gap-4">
          <CardTitle>Geschmacksmatrix</CardTitle>
          <div className="text-[13px] leading-normal text-ink-2">
            Wo deine Weine liegen und wie gut sie dir gefallen.
          </div>
          <Segmented label="Weinfarbe" value={color} onChange={(v) => { if (v) { setColor(v); setSelected(null) } }} options={[{ value: 'weiss', label: 'Weiß' }, { value: 'rot', label: 'Rot' }]} />
          <div className="flex gap-2">
            <div className="flex w-5 flex-none flex-col items-center justify-between py-1 text-xs font-bold text-muted">
              <span className="rotate-180 [writing-mode:vertical-rl]">frisch</span>
              <span className="rotate-180 [writing-mode:vertical-rl]">Säure →</span>
              <span className="rotate-180 [writing-mode:vertical-rl]">mild</span>
            </div>
            <div className="grid flex-1 grid-cols-5 gap-1">
              {data.cells.flat().map((c) => {
                const avg = mean(c.myScores)
                const col = cellColor(avg === null ? null : Math.round(avg), c.grapes.length > 0)
                const key = `${c.body}-${c.acidity}`
                const isSel = selected === key
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!c.grapes.length && !c.wines.length}
                    aria-pressed={isSel}
                    aria-label={`Körper ${c.body}, Säure ${c.acidity}: ${avg !== null ? `deine Ø ${Math.round(avg)}` : 'noch nichts bewertet'}`}
                    onClick={() => setSelected(isSel ? null : key)}
                    className="flex aspect-square flex-col items-center justify-center rounded-lg text-xs font-bold disabled:opacity-40"
                    style={{
                      background: col.bg,
                      color: col.fg,
                      outline: isSel ? '3px solid #1E1B24' : '1px solid #EEE9F0',
                      outlineOffset: isSel ? '-3px' : '-1px',
                    }}
                  >
                    {avg !== null ? Math.round(avg) : ''}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex justify-between pl-7 text-xs font-bold text-muted">
            <span>leicht</span>
            <span>Körper →</span>
            <span>kräftig</span>
          </div>
          <div className="text-xs leading-normal text-ink-2">
            Zahl = deine Ø-Note, je dunkler, desto besser. Feld antippen für Weine und Rebsorten.
          </div>
          {sel && (
            <div className="flex flex-col gap-2 rounded-[18px] bg-chip p-3.5">
              <div className="text-[13px] font-bold text-ink-2">
                Körper {tasteWord('body', sel.body)}, Säure {tasteWord('acidity', sel.acidity)}
              </div>
              {sel.wines.length > 0 && (
                <div className="flex flex-col">
                  <div className="text-xs font-bold text-muted">Deine Weine hier</div>
                  {sel.wines.slice(0, 6).map((w) => (
                    <Link key={w.wineId} to={`/wein/${w.wineId}`} className="flex min-h-10 items-center justify-between gap-2 text-[13px] font-semibold text-ink no-underline">
                      <span className="truncate">{w.name}</span>
                      <span className="flex-none font-extrabold text-berry">{Math.round(w.avg)}</span>
                    </Link>
                  ))}
                </div>
              )}
              {sel.grapes.length > 0 && <div className="text-xs font-bold text-muted">Typische Rebsorten</div>}
              <div className="flex flex-wrap gap-2">
                {sel.grapes.map((g) => (
                  <Link key={g.id} to={`/rebsorten/${g.id}`} className="rounded-full bg-card px-3 py-1.5 text-[13px] font-semibold text-ink no-underline">
                    {g.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>
        )}

        {data.recs.length > 0 && (
          <Card className="pb-1">
            <CardTitle>Probier mal</CardTitle>
            <div className="pt-2">
              {data.recs.map((r) => {
                const tip = data.friendTip.get(r.grape.id)
                return (
                  <div key={r.grape.id} className="flex flex-col gap-1 border-t border-line py-3">
                    <Link to={`/rebsorten/${r.grape.id}`} className="flex min-h-11 items-center justify-between gap-3 text-ink no-underline">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[15px] font-bold">{r.grape.name}</span>
                        <span className="text-[13px] text-muted">{[styleOf(r.grape), r.reason].filter(Boolean).join(' · ')}</span>
                      </span>
                      <IconNext size={18} className="flex-none text-muted" />
                    </Link>
                    {tip && (
                      <Link to={`/wein/${tip.wineId}`} className="flex items-center justify-between gap-2 rounded-[14px] bg-rose-badge px-3 py-2 text-[13px] text-berry-dark no-underline">
                        <span className="min-w-0 truncate"><b>Tipp aus deinen Gruppen:</b> {tip.name}</span>
                        <span className="flex-none font-extrabold">Ø {Math.round(tip.avg)}</span>
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {data.rows.length > 0 && (
          <Card className="flex flex-col gap-3.5">
            <CardTitle>Verlässlichkeit je Rebsorte</CardTitle>
            {data.rows.map((r) => {
              const inner = (
                <>
                  <span className="flex w-[120px] flex-none flex-col gap-px">
                    <span className="truncate text-sm font-bold">{r.name}</span>
                    <span className="text-xs text-muted">
                      {r.s.n} Bew. · {r.s.kind === 'box' ? `meist ${Math.round(r.s.median)}` : 'zu wenige'}
                    </span>
                  </span>
                  <Boxplot s={r.s} />
                </>
              )
              return r.id !== null ? (
                <Link key={r.key} to={`/rebsorten/${r.id}`} className="flex min-h-11 items-center gap-2.5 text-ink no-underline">{inner}</Link>
              ) : (
                <div key={r.key} className="flex min-h-11 items-center gap-2.5">{inner}</div>
              )
            })}
            <div className="flex gap-2.5">
              <span className="w-[120px] flex-none" />
              <AxisLabels />
            </div>
            <div className="rounded-[18px] bg-chip px-3.5 py-3 text-xs leading-normal text-ink-2">
              Je schmaler die Box, desto verlässlicher gefällt dir die Sorte. Strich = typische Note.
            </div>
          </Card>
        )}

        <Link to="/rebsorten" className="flex items-center gap-4 rounded-[28px] bg-card p-5 text-ink no-underline">
          <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-rose-badge text-berry">
            <IconBook size={24} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[17px] font-extrabold">Rebsorten-Glossar</span>
            <span className="text-[13px] text-muted">Nach Stil geordnet, mit Aromen, Regionen und Speisen</span>
          </span>
          <IconNext size={20} className="flex-none text-muted" />
        </Link>
      </div>
    </Page>
  )
}
