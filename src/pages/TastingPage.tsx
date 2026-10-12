import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { WineHit } from '../lib/types'
import { mean } from '../lib/stats'
import { formatDate } from '../lib/text'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { Avatar, Card, ErrorBox, HeroBack, Loading, Page } from '../components/ui'
import { IconClose } from '../components/Icons'

export default function TastingPage() {
  const id = Number(useParams().id)
  const { profile } = useApp()
  const res = useAsync(async () => {
    const detail = await api.tasting(id)
    if (!detail) return null
    const [mine, results] = await Promise.all([
      api.myRatings(),
      detail.tasting.status === 'aufgeloest' ? api.tastingRatings(id) : Promise.resolve([]),
    ])
    return { ...detail, mine: mine.filter((r) => r.tastingId === id), results }
  }, [id])
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<WineHit[]>([])

  useEffect(() => {
    if (!q.trim()) {
      setHits([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      api.searchWines(q).then((r) => alive && setHits(r.slice(0, 6))).catch(() => undefined)
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  const results = useMemo(() => {
    if (!res.data || res.data.tasting.status !== 'aufgeloest') return null
    const nameOf = new Map(res.data.progress.map((p) => [p.userId, p.displayName]))
    const rows = res.data.wines.map((w) => {
      const byUser = new Map<string, number[]>()
      for (const r of res.data!.results.filter((x) => x.wineId === w.id)) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r.score])
      const scores = [...byUser.entries()].map(([u, xs]) => ({ userId: u, name: u === profile.id ? 'Du' : nameOf.get(u) ?? '?', score: Math.round(mean(xs)!) }))
      const avg = scores.length ? Math.round(mean(scores.map((s) => s.score))!) : null
      const spread = scores.length >= 2 ? Math.max(...scores.map((s) => s.score)) - Math.min(...scores.map((s) => s.score)) : null
      return { wine: w, scores, avg, spread }
    })
    const ranked = rows.filter((r) => r.avg !== null).sort((a, b) => b.avg! - a.avg!)
    const withSpread = rows.filter((r) => r.spread !== null)
    const agree = withSpread.length ? [...withSpread].sort((a, b) => a.spread! - b.spread!)[0] : null
    const fight = withSpread.length ? [...withSpread].sort((a, b) => b.spread! - a.spread!)[0] : null
    return { ranked, unrated: rows.filter((r) => r.avg === null), agree, fight }
  }, [res.data, profile.id])

  if (res.loading && !res.data) return <Page nav={false}><Loading /></Page>
  if (res.error) return <Page nav={false}><ErrorBox message={res.error} /></Page>
  if (!res.data) return <Page nav={false}><ErrorBox message="Weinabend nicht gefunden." /></Page>

  const { tasting, wines, progress, mine } = res.data
  const isHost = tasting.hostId === profile.id
  const myScore = (wineId: number) => {
    const xs = mine.filter((r) => r.wineId === wineId).map((r) => r.score)
    return xs.length ? Math.round(mean(xs)!) : null
  }

  const add = async (w: WineHit) => {
    await api.addTastingWine(tasting.id, w.id)
    setQ('')
    res.reload()
  }
  const remove = async (wineId: number) => {
    await api.removeTastingWine(tasting.id, wineId)
    res.reload()
  }
  const reveal = async () => {
    if (!confirm('Weinabend jetzt auflösen? Danach sehen alle die Noten.')) return
    await api.revealTasting(tasting.id)
    res.reload()
  }

  // ---------------- Auflösung ----------------
  if (results) {
    const podium = results.ranked.slice(0, 3)
    const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium
    return (
      <Page nav={false}>
        <div className="flex flex-col gap-2.5 rounded-b-[36px] bg-hero px-5 pt-5 pb-6 text-white">
          <div className="mb-2"><HeroBack to="/freunde" /></div>
          <span className="text-sm font-bold opacity-90">{tasting.title} · aufgelöst</span>
          <h1 className="m-0 text-[28px] leading-[1.1] font-extrabold">Sieger des Abends</h1>
          {order.length > 0 && (
            <div className="mt-2 grid items-end gap-2" style={{ gridTemplateColumns: `repeat(${order.length}, minmax(0, 1fr))` }}>
              {order.map((r) => {
                const place = results.ranked.indexOf(r) + 1
                const h = place === 1 ? 100 : place === 2 ? 72 : 56
                return (
                  <div key={r.wine.id} className="flex flex-col items-center gap-1.5">
                    <span className={`text-center text-[13px] ${place === 1 ? 'font-extrabold' : 'font-bold'}`}>{r.wine.name}</span>
                    <span className={`flex w-full flex-col items-center justify-center rounded-t-2xl rounded-b-md ${place === 1 ? 'bg-white text-hero' : 'bg-white/20'}`} style={{ height: h }}>
                      <span className={`${place === 1 ? 'text-[28px]' : 'text-[22px]'} font-extrabold`}>{r.avg}</span>
                      <span className="text-[11px] font-bold">Platz {place}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4 px-4 pt-4">
          <Card className="pb-1">
            <h2 className="m-0 mb-3 text-lg font-bold">Alle Noten</h2>
            {results.ranked.map((r, i) => (
              <div key={r.wine.id} className="flex flex-col gap-2 border-t border-line py-3">
                <Link to={`/wein/${r.wine.id}`} className="flex items-center gap-2.5 text-ink no-underline">
                  <span className="w-6 flex-none text-base font-extrabold text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-[15px] font-bold">{r.wine.name}</span>
                  <span className="flex-none text-lg font-extrabold text-berry">Ø {r.avg}</span>
                </Link>
                <div className="flex flex-wrap gap-1.5 pl-[34px]">
                  {r.scores.map((s) => (
                    <span key={s.userId} className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.userId === profile.id ? 'bg-berry text-white' : 'bg-chip text-ink-2'}`}>{s.name} {s.score}</span>
                  ))}
                </div>
              </div>
            ))}
            {results.unrated.map((r) => (
              <div key={r.wine.id} className="border-t border-line py-3 text-sm text-muted">{r.wine.name}: keine sichtbaren Bewertungen</div>
            ))}
          </Card>
          {(results.agree || results.fight) && (
            <div className="grid grid-cols-2 gap-3">
              {results.agree && (
                <div className="flex flex-col gap-1 rounded-[22px] bg-card p-4">
                  <span className="text-xs font-bold text-muted">Größte Einigkeit</span>
                  <span className="text-[15px] font-extrabold">{results.agree.wine.name}</span>
                  <span className="text-[13px] text-ink-2">nur {results.agree.spread} Punkte Unterschied</span>
                </div>
              )}
              {results.fight && results.fight !== results.agree && (
                <div className="flex flex-col gap-1 rounded-[22px] bg-card p-4">
                  <span className="text-xs font-bold text-muted">Größter Streit</span>
                  <span className="text-[15px] font-extrabold">{results.fight.wine.name}</span>
                  <span className="text-[13px] text-ink-2">{results.fight.scores.map((s) => `${s.name} ${s.score}`).join(', ')}</span>
                </div>
              )}
            </div>
          )}
          <div className="px-1 text-xs leading-normal text-muted">Private Bewertungen erscheinen hier nicht.</div>
          <Link to="/abzeichen" className="flex h-12 items-center justify-center rounded-full border-2 border-line bg-card text-[15px] font-bold text-ink no-underline">Meine Abzeichen ansehen</Link>
        </div>
      </Page>
    )
  }

  // ---------------- Laufender Abend ----------------
  return (
    <Page nav={false}>
      <div className="flex flex-col gap-2.5 rounded-b-[36px] bg-hero px-5 pt-5 pb-16 text-white">
        <div className="mb-2"><HeroBack to="/freunde" /></div>
        <span className="self-start rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">Läuft · Gastgeber {isHost ? 'du' : tasting.hostName}</span>
        <h1 className="m-0 text-[28px] leading-[1.1] font-extrabold">{tasting.title}</h1>
        <div className="text-[15px] opacity-90">{tasting.groupName} · {formatDate(tasting.eventDate)}</div>
      </div>

      <div className="relative -mt-10 flex flex-col gap-4 px-4">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-lg font-bold">Wer ist dabei</h2>
            <span className="text-[13px] font-semibold text-muted">Fortschritt</span>
          </div>
          {progress.map((p) => (
            <div key={p.userId} className="flex items-center gap-3">
              <Avatar name={p.displayName} size={40} me={p.userId === profile.id} />
              <span className="flex-1 text-[15px] font-bold">{p.userId === profile.id ? 'Du' : p.displayName}</span>
              <span className="flex gap-1" aria-label={`${p.rated} von ${wines.length} bewertet`}>
                {wines.map((w, i) => (
                  <span key={w.id} className={`size-2.5 rounded-full ${i < p.rated ? 'bg-berry' : 'bg-line'}`} />
                ))}
              </span>
            </div>
          ))}
          <div className="text-xs leading-snug text-muted">Die Noten der anderen bleiben bis zur Auflösung verborgen, damit niemand beeinflusst wird.</div>
        </Card>

        <Card className="pb-1">
          <h2 className="m-0 mb-3 text-lg font-bold">Weine des Abends</h2>
          {wines.length === 0 && <div className="border-t border-line py-4 text-sm text-muted">{isHost ? 'Füge unten die Weine des Abends hinzu.' : 'Der Gastgeber hat noch keine Weine eingetragen.'}</div>}
          {wines.map((w, i) => {
            const s = myScore(w.id)
            return (
              <div key={w.id} className="flex items-center gap-3 border-t border-line py-3">
                <span className="flex size-8 flex-none items-center justify-center rounded-full bg-chip text-sm font-extrabold text-ink-2">{i + 1}</span>
                <Link to={`/wein/${w.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5 text-ink no-underline">
                  <span className="text-[15px] font-bold">{w.name}</span>
                  <span className="truncate text-[13px] text-muted">{[w.winery, w.mainGrape].filter(Boolean).join(' · ')}</span>
                </Link>
                {s !== null ? (
                  <span className="flex h-9 min-w-[52px] flex-none items-center justify-center rounded-xl bg-rose-badge px-2.5 text-base font-extrabold text-berry">{s}</span>
                ) : (
                  <Link to={`/wein/${w.id}/bewerten?abend=${tasting.id}`} className="flex h-9 flex-none items-center rounded-full bg-berry px-3.5 text-[13px] font-bold text-white no-underline">Bewerten</Link>
                )}
                {isHost && (
                  <button type="button" aria-label={`${w.name} entfernen`} onClick={() => remove(w.id)} className="flex size-9 flex-none items-center justify-center rounded-full text-muted">
                    <IconClose size={16} />
                  </button>
                )}
              </div>
            )
          })}
          {isHost && (
            <div className="flex flex-col gap-1 border-t border-line pt-3 pb-3">
              <label htmlFor="abend-wein" className="text-[13px] font-bold text-ink-2">Wein hinzufügen</label>
              <input id="abend-wein" type="search" autoComplete="off" placeholder="Wein suchen" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 rounded-full border-0 bg-chip px-[18px] text-base outline-none" />
              {hits.map((h) => (
                <button key={h.id} type="button" onClick={() => add(h)} className="flex min-h-11 flex-col items-start gap-0.5 border-b border-line py-2 text-left">
                  <span className="text-[15px] font-bold">{h.name}</span>
                  <span className="text-[13px] text-muted">{[h.winery, h.mainGrape, h.region].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="rounded-[22px] bg-card px-4 py-3.5 text-[13px] leading-normal text-ink-2">Jede Bewertung landet automatisch in deinem Verlauf, mit Datum und Anlass „{tasting.title}".</div>

        {isHost ? (
          <button type="button" onClick={reveal} disabled={wines.length === 0} className="flex h-14 items-center justify-center rounded-full bg-berry text-base font-bold text-white disabled:opacity-50">
            Abend auflösen
          </button>
        ) : (
          <div className="px-1 text-center text-[13px] text-muted">{tasting.hostName} löst den Abend am Ende auf.</div>
        )}
      </div>
    </Page>
  )
}
