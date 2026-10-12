import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { mean } from '../lib/stats'
import { formatDate, formatMonth, normalize } from '../lib/text'
import { downloadCsv, useAsync } from '../lib/util'
import { resetDemo } from '../lib/mockApi'
import { useApp } from '../App'
import { Card, ErrorBox, Loading, Page, PageTitle, ScoreBadge, TagChip, WineThumb } from '../components/ui'
import { IconBookmark, IconDownload, IconLock, IconLogout, IconMedal, IconNext, IconSearch } from '../components/Icons'

export default function HistoryPage() {
  const { profile, refreshProfile } = useApp()
  const res = useAsync(() => api.myRatings(), [])
  const saved = useAsync(() => api.savedWines(), [])
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [editName, setEditName] = useState(false)
  const [name, setName] = useState(profile.displayName)

  const all = res.data ?? []
  const tagList = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of all) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t)
  }, [all])

  const nq = normalize(q)
  const list = all.filter(
    (r) =>
      (!tag || r.tags.includes(tag)) &&
      (!nq || normalize([r.wineName, r.winery, r.region, r.note, ...r.tags].filter(Boolean).join(' ')).includes(nq)),
  )
  const avg = mean(all.map((r) => r.score))
  const grapeCount = new Set(all.flatMap((r) => (r.mainGrapeId === null ? [] : [r.mainGrapeId]))).size

  let lastMonth = ''

  return (
    <Page>
      <PageTitle title="Meine Verkostungen" />
      {res.error && <ErrorBox message={res.error} />}

      <div className="flex flex-col gap-4 px-4 pt-5">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            [String(all.length), 'Bewertungen'],
            [avg === null ? '–' : String(Math.round(avg)), 'Ø Note'],
            [String(grapeCount), 'Rebsorten'],
          ].map(([v, l], i) => (
            <div key={l} className="flex flex-col gap-0.5 rounded-[22px] bg-card px-3 py-3.5 text-center">
              <span className={`text-2xl font-extrabold ${i === 1 ? 'text-berry' : ''}`}>{v}</span>
              <span className="text-xs font-semibold text-muted">{l}</span>
            </div>
          ))}
        </div>

        <Link to="/abzeichen" className="flex items-center gap-3.5 rounded-[22px] bg-card px-4 py-3.5 text-ink no-underline">
          <span className="flex size-10 flex-none items-center justify-center rounded-full bg-berry text-white"><IconMedal size={22} /></span>
          <span className="flex-1 text-[15px] font-bold">Meine Abzeichen</span>
          <IconNext size={18} className="text-muted" />
        </Link>

        <div className="flex h-[52px] items-center gap-2.5 rounded-full bg-card px-[18px]">
          <IconSearch size={20} className="flex-none text-muted" />
          <label htmlFor="vsuche" className="sr-only">Verkostungen durchsuchen</label>
          <input id="vsuche" type="search" placeholder="Wein, Ort, Anlass oder Notiz" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base outline-none" />
        </div>

        {tagList.length > 0 && (
          <div role="group" aria-label="Nach Ort oder Anlass filtern" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
            {[null, ...tagList].map((t) => {
              const on = t === tag
              return (
                <button key={t ?? 'alle'} type="button" aria-pressed={on} onClick={() => setTag(t)} className={`h-10 flex-none rounded-full px-4 text-sm ${on ? 'bg-berry font-bold text-white' : 'bg-card font-semibold text-ink-2'}`}>
                  {t ?? 'Alle'}
                </button>
              )
            })}
          </div>
        )}

        <Card className="px-5 pt-2 pb-1">
          {res.loading && !res.data && <Loading />}
          {res.data && list.length === 0 && <div className="py-[18px] text-sm text-muted">{all.length ? 'Keine passenden Verkostungen.' : 'Noch keine Verkostung erfasst.'}</div>}
          {list.map((r) => {
            const month = formatMonth(r.tastedOn)
            const showMonth = month !== lastMonth
            lastMonth = month
            return (
              <div key={r.id}>
                {showMonth && <div className="pt-3.5 pb-1 text-[13px] font-extrabold text-muted">{month}</div>}
                <Link to={`/wein/${r.wineId}`} className="flex gap-3.5 border-b border-line py-3.5 text-ink no-underline">
                  <ScoreBadge score={r.score} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="text-[15px] font-bold">{r.wineName}</div>
                    <div className="text-xs font-semibold text-muted">
                      {formatDate(r.tastedOn)}
                      {r.vintage ? ` · Jahrgang ${r.vintage}` : ''}
                      {!r.shared && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-chip px-2 py-0.5 align-middle text-[11px] font-bold text-ink-2">
                          <IconLock size={11} /> privat
                        </span>
                      )}
                    </div>
                    {r.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{r.tags.map((t) => <TagChip key={t} label={t} />)}</div>}
                    {r.note && <div className="text-[13px] leading-snug text-muted">{r.note}</div>}
                  </div>
                </Link>
              </div>
            )
          })}
        </Card>

        <Card className="pb-1">
          <h2 className="m-0 mb-2 text-lg font-bold">Gemerkte Weine</h2>
          {saved.data && saved.data.length === 0 && (
            <div className="border-t border-line py-4 text-sm text-muted">Noch nichts gemerkt. Auf einer Weinseite oben rechts auf „Merken" tippen.</div>
          )}
          {saved.data?.map((w) => (
            <div key={w.id} className="flex items-center gap-3 border-t border-line py-3">
              <Link to={`/wein/${w.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-ink no-underline">
                <WineThumb labelUrl={w.labelUrl} type={w.type} size={48} alt={`Etikett ${w.name}`} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{w.name}</span>
                  <span className="truncate text-[13px] text-muted">{[w.winery, w.mainGrape, w.region].filter(Boolean).join(' · ')}</span>
                </span>
              </Link>
              <button
                type="button"
                aria-label={`${w.name} von der Merkliste entfernen`}
                onClick={async () => {
                  await api.setSaved(w.id, false)
                  saved.reload()
                }}
                className="flex size-11 flex-none items-center justify-center rounded-full text-berry"
              >
                <IconBookmark size={20} filled />
              </button>
            </div>
          ))}
        </Card>

        <Card className="pb-1">
          <h2 className="m-0 mb-2 text-lg font-bold">Profil</h2>
          <div className="flex min-h-11 items-center justify-between gap-3 border-t border-line py-3.5">
            {editName ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!name.trim()) return
                  await api.updateDisplayName(name.trim())
                  setEditName(false)
                  refreshProfile()
                }}
              >
                <label htmlFor="anzeigename" className="sr-only">Anzeigename</label>
                <input id="anzeigename" value={name} onChange={(e) => setName(e.target.value)} className="h-10 min-w-0 flex-1 rounded-full border-0 bg-chip px-4 text-base outline-none" />
                <button type="submit" className="h-10 rounded-full bg-berry px-4 text-[13px] font-bold text-white">Speichern</button>
              </form>
            ) : (
              <>
                <span className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-muted">Anzeigename</span>
                  <span className="text-[15px] font-bold">{profile.displayName}</span>
                </span>
                <button type="button" onClick={() => setEditName(true)} className="h-10 rounded-full bg-chip px-3.5 text-[13px] font-bold text-ink-2">Ändern</button>
              </>
            )}
          </div>
          <button type="button" onClick={() => downloadCsv(all)} disabled={!all.length} className="flex min-h-[52px] w-full items-center gap-3 border-t border-line py-3.5 text-left text-[15px] font-semibold disabled:opacity-50">
            <IconDownload size={20} className="text-ink-2" />
            Meine Bewertungen exportieren (CSV)
          </button>
          {api.mode === 'demo' && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Demo-Daten auf den Ausgangszustand zurücksetzen?')) {
                  resetDemo()
                  location.reload()
                }
              }}
              className="flex min-h-[52px] w-full items-center gap-3 border-t border-line py-3.5 text-left text-[15px] font-semibold"
            >
              Demo-Daten zurücksetzen
            </button>
          )}
          <button type="button" onClick={() => api.signOut()} className="flex min-h-[52px] w-full items-center gap-3 border-t border-line py-3.5 text-left text-[15px] font-semibold text-berry">
            <IconLogout size={20} />
            Abmelden
          </button>
        </Card>

        <p className="m-0 px-1 text-xs leading-normal text-muted">
          Weindaten: X-Wines (CC0) und Open Food Facts (openfoodfacts.org, Lizenz ODbL). Glossartexte: eigene Texte.
        </p>
      </div>
    </Page>
  )
}
