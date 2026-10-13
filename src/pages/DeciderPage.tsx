import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { decideForTable } from '../lib/social'
import type { CommunityStats, Wine, WineHit } from '../lib/types'
import { decide, type Candidate } from '../lib/decider'
import { normalize } from '../lib/text'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { Card, CardTitle, ErrorBox, Page, PageTitle, Segmented } from '../components/ui'
import { IconCheck, IconClose } from '../components/Icons'

interface Stored {
  key: string
  wineId: number | null
  grapeId: number | null
  label: string
  price: string
}

const STORE = 'decider-karte'

function loadStored(): Stored[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? '[]') as Stored[]
  } catch {
    return []
  }
}

export default function DeciderPage() {
  const { grapes, profile } = useApp()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'ich' | 'tisch'>(params.get('tisch') ? 'tisch' : 'ich')
  const [people, setPeople] = useState<Set<string>>(new Set([profile.id]))
  const [items, setItems] = useState<Stored[]>(loadStored)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<WineHit[]>([])
  const [wines, setWines] = useState<Map<number, Wine>>(new Map())
  const [comm, setComm] = useState<Map<number, CommunityStats>>(new Map())
  const tried = useRef(new Set<number>())
  const base = useAsync(async () => {
    const [mine, grapeComm, friends, friendRatings] = await Promise.all([api.myRatings(), api.grapeCommunity(), api.friends(), api.friendRatings()])
    return { mine, grapeComm, friends, friendRatings }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(items))
    } catch {
      // ignorieren
    }
  }, [items])

  // Weindaten und Community-Werte für gewählte Katalogweine nachladen
  useEffect(() => {
    const missing = items.flatMap((i) => (i.wineId !== null && !tried.current.has(i.wineId) ? [i.wineId] : []))
    if (!missing.length) return
    missing.forEach((id) => tried.current.add(id))
    Promise.all(missing.map(async (id) => ({ id, wine: await api.getWine(id), stats: await api.wineCommunity(id) }))).then((rs) => {
      setWines((m) => {
        const n = new Map(m)
        rs.forEach((r) => r.wine && n.set(r.id, r.wine))
        return n
      })
      setComm((m) => {
        const n = new Map(m)
        rs.forEach((r) => {
          const total = r.stats.find((s) => s.vintage === null)
          if (total) n.set(r.id, total)
        })
        return n
      })
    })
  }, [items])

  useEffect(() => {
    if (!q.trim()) {
      setHits([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      api.searchWines(q).then((r) => alive && setHits(r.slice(0, 5))).catch(() => undefined)
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  const nq = normalize(q)
  const grapeHits = nq.length >= 2 ? grapes.filter((g) => normalize([g.name, ...g.synonyms].join(' ')).includes(nq)).slice(0, 3) : []

  const add = (s: Omit<Stored, 'key' | 'price'>) => {
    setItems((cur) => [...cur, { ...s, key: `${Date.now()}-${cur.length}`, price: '' }])
    setQ('')
  }

  const candidates: Candidate[] = items.map((i) => {
    const wine = i.wineId !== null ? wines.get(i.wineId) ?? null : null
    const grapeName = grapes.find((g) => g.id === (wine?.grapeIds[0] ?? i.grapeId))?.name
    const sub = wine
      ? [wine.winery, grapeName, wine.region].filter(Boolean).join(' · ')
      : 'Nur Rebsorte bekannt'
    return { key: i.key, label: i.label, sub, wine, grapeId: i.grapeId, price: i.price }
  })

  const results = useMemo(() => {
    if (!base.data || candidates.length < 2) return []
    return decide(candidates, base.data.mine, grapes, base.data.grapeComm, comm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base.data, items, wines, comm, grapes])

  const tableResults = useMemo(() => {
    if (!base.data || mode !== 'tisch' || candidates.length < 2 || people.size === 0) return []
    const persons = [...people].map((id) =>
      id === profile.id
        ? { id, name: 'Ich', ratings: base.data!.mine }
        : { id, name: base.data!.friends.find((f) => f.userId === id)?.displayName ?? '?', ratings: base.data!.friendRatings.filter((r) => r.userId === id) },
    )
    return decideForTable(candidates, persons, grapes, base.data.grapeComm, comm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base.data, items, wines, comm, grapes, mode, people, profile.id])

  const togglePerson = (id: string) =>
    setPeople((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const priceOf = (key: string) => items.find((i) => i.key === key)?.price

  return (
    <Page>
      <PageTitle title="Decider" sub={mode === 'tisch' ? 'Welcher Wein schmeckt allen?' : 'Welcher Wein passt am besten zu dir?'} />
      {base.error && <ErrorBox message={base.error} />}

      <div className="flex flex-col gap-4 px-4 pt-5">
        <div className="rounded-full bg-card p-1">
          <Segmented label="Für wen" value={mode} onChange={(v) => v && setMode(v)} options={[{ value: 'ich', label: 'Nur für mich' }, { value: 'tisch', label: 'Für mehrere' }]} />
        </div>

        {mode === 'tisch' && (
          <Card className="flex flex-col gap-3">
            <h2 className="m-0 text-lg font-bold">Wer trinkt mit?</h2>
            <div className="flex flex-wrap gap-2">
              {[{ userId: profile.id, displayName: 'Ich' }, ...(base.data?.friends ?? [])].map((f) => (
                <button key={f.userId} type="button" aria-pressed={people.has(f.userId)} onClick={() => togglePerson(f.userId)} className={`min-h-10 rounded-full px-4 text-sm ${people.has(f.userId) ? 'bg-berry font-bold text-white' : 'bg-chip font-semibold text-ink-2'}`}>
                  {f.displayName}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted">
              {(base.data?.friends.length ?? 0) === 0 ? 'Noch keine Freunde: Lege unter „Freunde" eine Gruppe an.' : 'Aus deinen Gruppen.'}
            </div>
          </Card>
        )}
        <Card className="flex flex-col gap-1">
          <CardTitle
            right={
              items.length > 0 ? (
                <button type="button" onClick={() => setItems([])} className="min-h-11 text-sm font-bold text-berry">
                  Leeren
                </button>
              ) : undefined
            }
          >
            Weine zur Auswahl
          </CardTitle>
          <div className="pt-2">
            {items.map((it, idx) => {
              const c = candidates[idx]
              return (
                <div key={it.key} className="flex items-center gap-3 border-t border-line py-3">
                  <div className="flex size-8 flex-none items-center justify-center rounded-full bg-chip text-sm font-extrabold text-ink-2">{idx + 1}</div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="text-[15px] font-bold">{it.label}</div>
                    <div className="truncate text-[13px] text-muted">{c.sub}</div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${it.wineId ? 'bg-chip text-ink-2' : 'bg-rose-badge text-berry-dark'}`}>
                        {it.wineId ? 'aus dem Katalog' : 'nur Rebsorte'}
                      </span>
                      <label className="sr-only" htmlFor={`preis-${it.key}`}>Preis</label>
                      <input
                        id={`preis-${it.key}`}
                        inputMode="decimal"
                        placeholder="Preis €"
                        value={it.price}
                        onChange={(e) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, price: e.target.value } : x)))}
                        className="h-8 w-20 rounded-full border-0 bg-chip px-3 text-xs font-semibold outline-none"
                      />
                    </div>
                  </div>
                  <button type="button" aria-label={`${it.label} entfernen`} onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))} className="flex size-11 flex-none items-center justify-center rounded-full text-muted">
                    <IconClose size={18} />
                  </button>
                </div>
              )
            })}
          </div>

          <label htmlFor="karte" className="sr-only">Wein oder Rebsorte hinzufügen</label>
          <input
            id="karte"
            type="search"
            autoComplete="off"
            placeholder={items.length ? 'Weiteren Wein oder Rebsorte hinzufügen' : 'Wein oder Rebsorte hinzufügen'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-2 h-12 w-full rounded-full border-0 bg-chip px-[18px] text-base outline-none"
          />
          {(hits.length > 0 || grapeHits.length > 0) && (
            <div className="flex flex-col pt-1">
              {grapeHits.map((g) => (
                <button key={`g${g.id}`} type="button" onClick={() => add({ wineId: null, grapeId: g.id, label: g.name })} className="flex min-h-11 items-center justify-between gap-2 border-b border-line py-2 text-left">
                  <span className="text-[15px] font-bold">{g.name}</span>
                  <span className="text-xs font-semibold text-muted">nur Rebsorte</span>
                </button>
              ))}
              {hits.map((h) => (
                <button key={`w${h.id}`} type="button" onClick={() => add({ wineId: h.id, grapeId: null, label: h.name })} className="flex min-h-11 flex-col items-start gap-0.5 border-b border-line py-2 text-left">
                  <span className="text-[15px] font-bold">{h.name}</span>
                  <span className="text-[13px] text-muted">{[h.winery, h.mainGrape, h.region].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </div>
          )}
          {items.length < 2 && <div className="pt-3 text-[13px] text-muted">Mindestens zwei Weine hinzufügen, von Karte, Regal oder Liste. Nicht im Katalog? Rebsorte wählen.</div>}
        </Card>

        {mode === 'tisch' && tableResults.length > 0 && (
          <>
            <h2 className="m-0 mt-2 px-1 text-lg font-bold">Empfehlung für alle</h2>
            {tableResults.map((r, i) => {
              const first = i === 0
              return (
                <section key={r.key} className={`flex flex-col gap-3.5 rounded-[28px] p-5 ${first ? 'bg-hero text-white' : 'bg-card text-ink'}`}>
                  <div className="flex items-center gap-3.5">
                    <div className={`flex size-[60px] flex-none flex-col items-center justify-center rounded-[20px] ${first ? 'bg-white text-hero' : 'bg-rose-badge text-berry'}`}>
                      <span className="text-[22px] leading-none font-extrabold">{r.score}</span>
                      <span className="text-[10px] font-bold">Alle</span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      {first && <span className="self-start rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">Beste Wahl für alle</span>}
                      <span className="text-lg font-extrabold">{r.label}</span>
                      <span className={`text-[13px] ${first ? 'opacity-90' : 'text-muted'}`}>{[r.sub, priceOf(r.key) ? `${priceOf(r.key)} €` : ''].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {r.perPerson.map((p) => (
                      <div key={p.id} className="flex items-center gap-2.5">
                        <span className="w-14 flex-none truncate text-[13px] font-bold">{p.name}</span>
                        <span className={`h-2 flex-1 overflow-hidden rounded-full ${first ? 'bg-white/25' : 'bg-rose'}`}>
                          <span className={`block h-2 rounded-full ${first ? 'bg-white' : 'bg-berry'}`} style={{ width: `${Math.max(0, Math.min(100, ((p.score - 70) / 30) * 100))}%` }} />
                        </span>
                        <span className="w-6 flex-none text-right text-[13px] font-extrabold">{p.score}</span>
                      </div>
                    ))}
                  </div>
                  {r.weakest && (
                    <div className={`rounded-[14px] px-3 py-2 text-[13px] font-semibold ${first ? 'bg-white/15' : 'bg-chip text-ink-2'}`}>
                      {r.weakest.name === 'Ich' ? 'Für dich' : `${r.weakest.name}`} eher nicht: Passung nur {r.weakest.score}.
                    </div>
                  )}
                </section>
              )
            })}
            <div className="px-1 text-xs leading-normal text-muted">
              Es gewinnt der Wein, mit dem alle zufrieden sind.
            </div>
          </>
        )}

        {mode === 'ich' && results.length > 0 && (
          <>
            <h2 className="m-0 mt-2 px-1 text-lg font-bold">Empfehlung</h2>
            {results.map((r, i) =>
              i === 0 ? (
                <section key={r.key} className="flex flex-col gap-3.5 rounded-[28px] bg-hero px-5 py-[22px] text-white">
                  <div className="flex items-center gap-4">
                    <div className="flex size-16 flex-none flex-col items-center justify-center rounded-[20px] bg-white text-hero">
                      <span className="text-2xl leading-none font-extrabold">{r.score}</span>
                      <span className="text-[10px] font-bold">Passung</span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="self-start rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">Beste Wahl · Sicherheit {r.confidence}</span>
                      <span className="text-xl font-extrabold">{r.label}</span>
                      <span className="text-sm opacity-90">{[r.sub, priceOf(r.key) ? `${priceOf(r.key)} €` : ''].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                  <div className="h-px bg-white/20" />
                  {r.reasons.map((w) => (
                    <div key={w} className="flex items-start gap-2.5 text-sm leading-normal">
                      <IconCheck size={18} className="mt-px flex-none" />
                      <span>{w}</span>
                    </div>
                  ))}
                </section>
              ) : (
                <Card key={r.key} className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex size-14 flex-none flex-col items-center justify-center rounded-[18px] bg-rose-badge text-berry">
                      <span className="text-[21px] leading-none font-extrabold">{r.score}</span>
                      <span className="text-[10px] font-bold">Passung</span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[17px] font-extrabold">{r.label}</span>
                      <span className="text-[13px] text-muted">{[r.sub, priceOf(r.key) ? `${priceOf(r.key)} €` : ''].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                  {r.reasons.map((w) => (
                    <div key={w} className="flex items-start gap-2.5 text-sm leading-normal text-ink-2">
                      <span className="mt-2 size-1.5 flex-none rounded-full bg-berry" />
                      <span>{w}</span>
                    </div>
                  ))}
                </Card>
              ),
            )}
            <div className="px-1 text-[13px] leading-normal text-muted">
              Auf Basis deiner {base.data?.mine.length ?? 0} Bewertungen.
            </div>
          </>
        )}
      </div>
    </Page>
  )
}
