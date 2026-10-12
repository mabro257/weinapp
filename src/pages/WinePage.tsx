import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { WINE_TYPE_LABEL } from '../lib/types'
import { PRICE_LABEL, TASTE, formatDate, tasteWord, type TasteKey } from '../lib/text'
import { mean } from '../lib/stats'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { Card, CardTitle, ErrorBox, Hint, HeroBack, Loading, Page, ScoreRing, TagChip, TasteBar } from '../components/ui'
import { IconBookmark, IconLock, IconPlus, IconSend, IconTrash, IconUsers } from '../components/Icons'
import RecommendSheet from '../components/RecommendSheet'

export default function WinePage() {
  const id = Number(useParams().id)
  const { grapes } = useApp()
  const [vintage, setVintage] = useState<number | 'alle'>('alle')
  const [showAll, setShowAll] = useState(false)
  const [recommendOpen, setRecommendOpen] = useState(false)

  const [savedOverride, setSavedOverride] = useState<boolean | null>(null)
  const res = useAsync(async () => {
    const [wine, community, mine, isSaved] = await Promise.all([api.getWine(id), api.wineCommunity(id), api.myRatings(), api.isSaved(id)])
    setSavedOverride(null)
    return { wine, community, mine: mine.filter((r) => r.wineId === id), isSaved }
  }, [id])

  const view = useMemo(() => {
    if (!res.data) return null
    const { community, mine } = res.data
    const vintages = [...new Set([...mine.flatMap((r) => (r.vintage ? [r.vintage] : [])), ...community.flatMap((c) => (c.vintage ? [c.vintage] : []))])].sort((a, b) => b - a)
    const rows = vintage === 'alle' ? mine : mine.filter((r) => r.vintage === vintage)
    const comm = community.find((c) => (vintage === 'alle' ? c.vintage === null : c.vintage === vintage)) ?? null
    const my = mean(rows.map((r) => r.score))
    const tasteMine = (k: TasteKey) => mean(rows.flatMap((r) => (r[k] ? [r[k] as number] : [])))
    return { vintages, rows, comm, my: my === null ? null : Math.round(my), tasteMine }
  }, [res.data, vintage])

  if (res.loading && !res.data) return <Page><Loading /></Page>
  if (res.error) return <Page><ErrorBox message={res.error} /></Page>
  if (!res.data?.wine || !view) return <Page><ErrorBox message="Wein nicht gefunden." /></Page>

  const wine = res.data.wine
  const grapeChips = wine.grapeIds.map((g) => grapes.find((x) => x.id === g)).filter((g) => g !== undefined)
  const hasTaste = (['body', 'acidity', 'tannin'] as TasteKey[]).some((k) => view.tasteMine(k) !== null || (view.comm && view.comm[k] !== null))
  const shown = showAll ? view.rows : view.rows.slice(0, 3)
  const saved = savedOverride ?? res.data.isSaved

  const toggleSaved = async () => {
    const next = !saved
    setSavedOverride(next)
    try {
      await api.setSaved(wine.id, next)
    } catch {
      setSavedOverride(!next)
    }
  }

  const toggleShared = async (ratingId: number, shared: boolean) => {
    await api.setRatingShared(ratingId, shared)
    res.reload()
  }

  const remove = async (ratingId: number) => {
    if (!confirm('Diese Bewertung wirklich löschen?')) return
    await api.deleteRating(ratingId)
    res.reload()
  }

  return (
    <Page>
      <div className="flex flex-col gap-3 rounded-b-[36px] bg-hero px-5 pt-5 pb-[72px] text-white">
        <div className="mb-3 flex items-center justify-between">
          <HeroBack />
          <span className="flex gap-2">
          <button
            type="button"
            onClick={() => setRecommendOpen(true)}
            className="flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-bold text-white"
          >
            <IconSend size={18} />
            Empfehlen
          </button>
          <button
            type="button"
            aria-pressed={saved}
            onClick={toggleSaved}
            className="flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-bold text-white"
          >
            <IconBookmark size={20} filled={saved} />
            {saved ? 'Gemerkt' : 'Merken'}
          </button>
          </span>
        </div>
        <div className="flex items-end gap-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {grapeChips.map((g, i) => (
                <Link key={g.id} to={`/rebsorten/${g.id}`} className={`rounded-full px-3 py-1.5 text-[13px] text-white no-underline ${i === 0 ? 'bg-white/20 font-bold' : 'bg-white/12 font-semibold'}`}>
                  {g.name}
                </Link>
              ))}
              {wine.type && <span className="rounded-full bg-white/12 px-3 py-1.5 text-[13px] font-semibold">{WINE_TYPE_LABEL[wine.type]}</span>}
              {wine.region && <span className="rounded-full bg-white/12 px-3 py-1.5 text-[13px] font-semibold">{wine.region}</span>}
              {wine.priceClass && <span className="rounded-full bg-white/12 px-3 py-1.5 text-[13px] font-semibold">{PRICE_LABEL[wine.priceClass]}</span>}
            </div>
            <h1 className="m-0 text-[30px] leading-[1.1] font-extrabold">{wine.name}</h1>
            <div className="text-[15px] font-medium opacity-90">{[wine.winery, wine.country].filter(Boolean).join(' · ')}</div>
          </div>
          {wine.labelUrl && <img src={wine.labelUrl} alt={`Etikett ${wine.name}`} className="h-[84px] w-16 flex-none rounded-[14px] border-2 border-white/30 object-cover" />}
        </div>
      </div>

      <div className="relative -mt-12 flex flex-col gap-4 px-4">
        <Card className="flex items-center gap-5">
          <ScoreRing value={view.my} />
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <div>
              <div className="text-[13px] font-semibold text-muted">Meine Ø</div>
              <div className="text-[17px] font-bold">
                {view.my === null ? 'noch nicht bewertet' : `${view.my} · ${view.rows.length} ${view.rows.length === 1 ? 'Verkostung' : 'Verkostungen'}`}
              </div>
            </div>
            <div className="h-px bg-line" />
            <div>
              <div className="text-[13px] font-semibold text-muted">Gruppen Ø</div>
              <div className="text-[17px] font-bold">
                {view.comm ? `${Math.round(view.comm.avg)} · ${view.comm.raters} ${view.comm.raters === 1 ? 'Person' : 'Personen'}` : 'noch keine Bewertung in deinen Gruppen'}
              </div>
            </div>
          </div>
        </Card>

        {view.vintages.length > 0 && (
          <div role="group" aria-label="Jahrgang wählen" className="flex gap-1 overflow-x-auto rounded-full bg-card p-1.5">
            {(['alle', ...view.vintages] as const).map((v) => {
              const on = v === vintage
              return (
                <button key={v} type="button" aria-pressed={on} onClick={() => setVintage(v)} className={`h-11 flex-none rounded-full px-[18px] text-sm ${on ? 'bg-berry font-bold text-white' : 'font-semibold text-ink-2'}`}>
                  {v === 'alle' ? 'Alle Jahrgänge' : v}
                </button>
              )
            })}
          </div>
        )}

        {hasTaste && (
          <Card className="flex flex-col gap-[18px]">
            <CardTitle right={<Hint>Skala 1–5</Hint>}>Geschmack</CardTitle>
            {(['body', 'acidity', 'tannin'] as TasteKey[]).map((k) => {
              const m = view.tasteMine(k)
              const c = view.comm?.[k] ?? null
              if (m === null && c === null) return null
              return <TasteBar key={k} label={TASTE[k].label} word={tasteWord(k, m ?? c)} mine={m} community={c} />
            })}
            <div className="flex gap-4 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-berry" />Ich</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full border-[3px] border-ink bg-white" />Gruppen</span>
            </div>
          </Card>
        )}

        <Card className="pb-1">
          <CardTitle
            right={
              view.rows.length > 3 ? (
                <button type="button" onClick={() => setShowAll((s) => !s)} className="min-h-11 text-sm font-bold text-berry">
                  {showAll ? 'Weniger' : `Alle ${view.rows.length}`}
                </button>
              ) : undefined
            }
          >
            Meine Verkostungen
          </CardTitle>
          <div className="pt-3">
            {view.rows.length === 0 && <div className="border-t border-line py-4 text-sm text-muted">Noch keine eigene Verkostung{vintage !== 'alle' ? ' in diesem Jahrgang' : ''}.</div>}
            {shown.map((r) => (
              <div key={r.id} className="flex gap-3.5 border-t border-line py-4">
                <div className="flex size-14 flex-none items-center justify-center rounded-[18px] bg-rose-badge text-[22px] font-extrabold text-berry">{r.score}</div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="text-sm font-bold">
                    {formatDate(r.tastedOn)}
                    {r.vintage ? ` · Jahrgang ${r.vintage}` : ''}
                  </div>
                  {r.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{r.tags.map((t) => <TagChip key={t} label={t} />)}</div>}
                  {r.note && <div className="text-[13px] leading-snug text-muted">{r.note}</div>}
                </div>
                <button
                  type="button"
                  aria-label={r.shared ? 'Für Gruppen sichtbar, tippen für privat' : 'Privat, tippen um für Gruppen sichtbar zu machen'}
                  onClick={() => toggleShared(r.id, !r.shared)}
                  className={`flex size-11 flex-none items-center justify-center rounded-full ${r.shared ? 'text-muted' : 'bg-rose-badge text-berry'}`}
                >
                  {r.shared ? <IconUsers size={18} /> : <IconLock size={18} />}
                </button>
                <button type="button" aria-label="Bewertung löschen" onClick={() => remove(r.id)} className="flex size-11 flex-none items-center justify-center rounded-full text-muted">
                  <IconTrash size={18} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Link to={`/wein/${wine.id}/bewerten`} className="flex h-14 items-center justify-center gap-2 rounded-full bg-berry text-base font-bold text-white no-underline hover:bg-berry-dark">
          <IconPlus size={20} />
          Neue Bewertung
        </Link>
      </div>
      {recommendOpen && <RecommendSheet wine={wine} myScore={view.my} onClose={() => setRecommendOpen(false)} />}
    </Page>
  )
}
