import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { WineHit } from '../lib/types'
import { mean } from '../lib/stats'
import { formatDate, tastingWhen } from '../lib/text'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { Avatar, Card, ErrorBox, HeroBack, Loading, Page, Switch } from '../components/ui'
import { IconCheck, IconClose, IconEye, IconEyeOff, IconTrash } from '../components/Icons'

/** Gastgeber: festlegen, wer aus der Gruppe beim Abend dabei ist */
function Participants({ tastingId, groupId, hostId, current, onDone }: { tastingId: number; groupId: number; hostId: string; current: string[]; onDone: () => void }) {
  const members = useAsync(() => api.groupMembers(groupId), [groupId])
  const [sel, setSel] = useState<Set<string>>(new Set(current))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.setTastingParticipants(tastingId, [...sel])
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="m-0 text-lg font-bold">Wer ist dabei?</h2>
      {members.loading && !members.data && <Loading />}
      <div className="flex flex-wrap gap-2">
        {(members.data ?? []).map((m) => {
          const host = m.userId === hostId
          const on = host || sel.has(m.userId)
          return (
            <button
              key={m.userId}
              type="button"
              aria-pressed={on}
              disabled={host}
              onClick={() =>
                setSel((cur) => {
                  const n = new Set(cur)
                  if (n.has(m.userId)) n.delete(m.userId)
                  else n.add(m.userId)
                  return n
                })
              }
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm ${on ? 'bg-berry font-bold text-white' : 'bg-chip font-semibold text-ink-2'}`}
            >
              {on && <IconCheck size={14} />}
              {host ? 'Du (Gastgeber)' : m.displayName}
            </button>
          )
        })}
      </div>
      <div className="text-xs leading-snug text-muted">Wer nicht dabei ist, sieht den Abend nicht und kann nicht bewerten.</div>
      {error && <div role="alert" className="text-sm font-semibold text-berry-dark">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onDone} disabled={busy} className="min-h-11 rounded-full bg-chip text-sm font-bold text-ink-2">Abbrechen</button>
        <button type="button" onClick={save} disabled={busy} className="min-h-11 rounded-full bg-berry text-sm font-bold text-white disabled:opacity-50">{busy ? 'Speichert …' : 'Speichern'}</button>
      </div>
    </Card>
  )
}

/** Gastgeber: Weinabend absagen bzw. löschen, wahlweise mit allen Bewertungen des Abends */
function DeleteTasting({ tastingId, revealed, onDone }: { tastingId: number; revealed: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [withRatings, setWithRatings] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = revealed ? 'Weinabend löschen' : 'Weinabend absagen'

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-berry">
        <IconTrash size={18} />
        {label}
      </button>
    )

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteTasting(tastingId, withRatings)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3.5">
      <h2 className="m-0 text-lg font-bold">{label}?</h2>
      <div className="text-[13px] leading-normal text-ink-2">Der Abend verschwindet für alle Mitglieder der Gruppe. Das lässt sich nicht rückgängig machen.</div>
      <div className="flex items-center justify-between gap-4 rounded-[18px] bg-chip px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span id="abend-bewertungen" className="text-[15px] font-bold">Alle Bewertungen löschen</span>
          <span className="text-[13px] leading-snug text-muted">
            {withRatings
              ? 'Die Bewertungen dieses Abends werden für jeden Teilnehmer gelöscht.'
              : `Die Bewertungen bleiben in den Verläufen der Teilnehmer, ohne Bezug zum Abend.${revealed ? '' : ' Bisher verdeckte Noten werden damit wie normale Bewertungen für die Gruppe sichtbar.'}`}
          </span>
        </div>
        <Switch checked={withRatings} onChange={setWithRatings} labelledBy="abend-bewertungen" />
      </div>
      {error && <div role="alert" className="rounded-2xl bg-rose-badge px-4 py-3 text-sm font-semibold text-berry-dark">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className="min-h-12 rounded-full bg-chip text-[15px] font-bold text-ink-2">
          Abbrechen
        </button>
        <button type="button" onClick={run} disabled={busy} className="min-h-12 rounded-full bg-berry text-[15px] font-bold text-white disabled:opacity-50">
          {busy ? 'Löscht …' : 'Endgültig löschen'}
        </button>
      </div>
    </Card>
  )
}

export default function TastingPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
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
  const [editPeople, setEditPeople] = useState(false)

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
  // Für den Fortschritt zählen nur die sichtbaren Weine
  const shown = wines.filter((w) => w.visible)
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
  const setVisible = async (wineId: number, visible: boolean) => {
    await api.setTastingWineVisible(tasting.id, wineId, visible)
    res.reload()
  }
  const showAll = async () => {
    for (const w of wines.filter((x) => !x.visible)) await api.setTastingWineVisible(tasting.id, w.id, true)
    res.reload()
  }
  const reveal = async () => {
    if (!confirm('Bewertungen jetzt aufdecken? Danach sehen alle die Noten und alle Weine des Abends.')) return
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
          <span className="text-sm font-bold opacity-90">{tasting.title} · aufgedeckt</span>
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
          {isHost && <DeleteTasting tastingId={tasting.id} revealed onDone={() => navigate('/freunde', { replace: true })} />}
        </div>
      </Page>
    )
  }

  // ---------------- Laufender Abend ----------------
  return (
    <Page nav={false}>
      <div className="flex flex-col gap-2.5 rounded-b-[36px] bg-hero px-5 pt-5 pb-16 text-white">
        <div className="mb-2"><HeroBack to="/freunde" /></div>
        <span className="self-start rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">{tastingWhen(tasting.eventDate)} · Gastgeber {isHost ? 'du' : tasting.hostName}</span>
        <h1 className="m-0 text-[28px] leading-[1.1] font-extrabold">{tasting.title}</h1>
        <div className="text-[15px] opacity-90">{tasting.groupName} · {formatDate(tasting.eventDate)}</div>
      </div>

      <div className="relative -mt-10 flex flex-col gap-4 px-4">
        {editPeople ? (
          <Participants
            tastingId={tasting.id}
            groupId={tasting.groupId}
            hostId={tasting.hostId}
            current={progress.map((p) => p.userId)}
            onDone={() => {
              setEditPeople(false)
              res.reload()
            }}
          />
        ) : (
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-lg font-bold">Wer ist dabei</h2>
              {isHost ? (
                <button type="button" onClick={() => setEditPeople(true)} className="min-h-10 text-sm font-bold text-berry">Ändern</button>
              ) : (
                <span className="text-[13px] font-semibold text-muted">Fortschritt</span>
              )}
            </div>
            {progress.map((p) => (
              <div key={p.userId} className="flex items-center gap-3">
                <Avatar name={p.displayName} size={40} me={p.userId === profile.id} />
                <span className="flex-1 text-[15px] font-bold">{p.userId === profile.id ? 'Du' : p.displayName}</span>
                <span className="flex gap-1" aria-label={`${p.rated} von ${shown.length} bewertet`}>
                  {shown.map((w, i) => (
                    <span key={w.id} className={`size-2.5 rounded-full ${i < p.rated ? 'bg-berry' : 'bg-line'}`} />
                  ))}
                </span>
              </div>
            ))}
            <div className="text-xs leading-snug text-muted">Die Noten der anderen bleiben verborgen, bis {isHost ? 'du' : tasting.hostName} die Bewertungen aufdeckst{isHost ? '' : 't'}. So wird niemand beeinflusst.</div>
          </Card>
        )}

        <Card className="pb-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-bold">Weine des Abends</h2>
            {isHost && wines.some((w) => !w.visible) && (
              <button type="button" onClick={showAll} className="min-h-10 text-sm font-bold text-berry">Alle zeigen</button>
            )}
          </div>
          {wines.length === 0 && (
            <div className="border-t border-line py-4 text-sm text-muted">
              {isHost ? 'Füge unten die Weine des Abends hinzu. Sie bleiben verdeckt, bis du sie sichtbar schaltest.' : `${tasting.hostName} hat noch keinen Wein freigegeben. Sobald es losgeht, erscheint er hier.`}
            </div>
          )}
          {wines.map((w, i) => {
            const s = myScore(w.id)
            return (
              <div key={w.id} className="flex items-center gap-2 border-t border-line py-3">
                <Link to={`/wein/${w.id}/bewerten?abend=${tasting.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-ink no-underline">
                  <span className="flex size-8 flex-none items-center justify-center rounded-full bg-chip text-sm font-extrabold text-ink-2">{i + 1}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`text-[15px] font-bold ${w.visible ? '' : 'text-muted'}`}>{w.name}</span>
                    <span className="truncate text-[13px] text-muted">
                      {isHost && !w.visible ? 'verdeckt · nur du siehst ihn' : [w.winery, w.mainGrape].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {s !== null ? (
                    <span className="flex h-9 min-w-[52px] flex-none items-center justify-center rounded-xl bg-rose-badge px-2.5 text-base font-extrabold text-berry">{s}</span>
                  ) : (
                    <span className="flex h-9 flex-none items-center rounded-full bg-berry px-3.5 text-[13px] font-bold text-white">Bewerten</span>
                  )}
                </Link>
                {isHost && (
                  <button
                    type="button"
                    aria-label={w.visible ? `${w.name} wieder verdecken` : `${w.name} für alle sichtbar schalten`}
                    aria-pressed={w.visible}
                    onClick={() => setVisible(w.id, !w.visible)}
                    className={`flex size-9 flex-none items-center justify-center rounded-full ${w.visible ? 'text-muted' : 'bg-rose-badge text-berry'}`}
                  >
                    {w.visible ? <IconEye size={18} /> : <IconEyeOff size={18} />}
                  </button>
                )}
                {isHost && (
                  <button type="button" aria-label={`${w.name} entfernen`} onClick={() => remove(w.id)} className="flex size-9 flex-none items-center justify-center rounded-full text-muted">
                    <IconClose size={16} />
                  </button>
                )}
              </div>
            )
          })}
          {isHost && wines.length > 0 && (
            <div className="border-t border-line py-3 text-xs leading-snug text-muted">
              Auge durchgestrichen: verdeckt, die anderen sehen den Wein noch nicht. Antippen schaltet ihn sichtbar.
            </div>
          )}
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
            Bewertungen aufdecken
          </button>
        ) : (
          <div className="px-1 text-center text-[13px] text-muted">{tasting.hostName} deckt am Ende die Bewertungen auf.</div>
        )}
        {isHost && <DeleteTasting tastingId={tasting.id} revealed={false} onDone={() => navigate('/freunde', { replace: true })} />}
      </div>
    </Page>
  )
}
