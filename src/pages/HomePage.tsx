import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { WineHit } from '../lib/types'
import { formatDate } from '../lib/text'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { Card, CardTitle, Page, ScoreBadge } from '../components/ui'
import { IconClose, IconNext, IconPlus, IconScale, IconSearch } from '../components/Icons'

function greeting() {
  const h = new Date().getHours()
  return h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend'
}

export default function HomePage() {
  const { profile } = useApp()
  const [q, setQ] = useState(() => sessionStorage.getItem('suche') ?? '')
  const [hits, setHits] = useState<WineHit[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const recent = useAsync(() => api.myRatings(), [])

  // Suche mit kurzer Verzögerung, damit nicht jeder Tastendruck eine Anfrage auslöst
  useEffect(() => {
    try {
      sessionStorage.setItem('suche', q)
    } catch {
      // ignorieren
    }
    if (!q.trim()) {
      setHits(null)
      return
    }
    let alive = true
    const t = setTimeout(() => {
      api
        .searchWines(q)
        .then((r) => alive && (setHits(r), setSearchError(null)))
        .catch((e: Error) => alive && setSearchError(e.message))
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  const latest = (recent.data ?? []).slice(0, 3)

  return (
    <Page>
      <div className="flex flex-col gap-1.5 px-4 pt-7">
        <div className="text-sm font-semibold text-muted">
          {greeting()}, {profile.displayName}
        </div>
        <h1 className="m-0 text-[28px] leading-tight font-extrabold">Welchen Wein trinkst du?</h1>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-5">
        <label htmlFor="suche" className="text-[13px] font-bold text-ink-2">
          Wein, Weingut oder Rebsorte
        </label>
        <div className="flex h-14 items-center gap-2.5 rounded-full bg-card pr-2 pl-[18px]">
          <IconSearch className="flex-none text-muted" />
          <input
            id="suche"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="z. B. Chianti, Riesling, Musterhof"
            className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base font-semibold outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" aria-label="Suche leeren" onClick={() => setQ('')} className="flex size-11 flex-none items-center justify-center rounded-full bg-chip text-ink-2">
              <IconClose size={18} />
            </button>
          )}
        </div>

        {q.trim() && (
          <div className="flex flex-col rounded-[28px] bg-card px-4 py-2">
            {searchError && <div className="py-3 text-sm font-semibold text-berry-dark">{searchError}</div>}
            {hits === null && !searchError && <div className="py-3 text-sm text-muted">Suche …</div>}
            {hits?.map((w) => (
              <Link key={w.id} to={`/wein/${w.id}`} className="flex min-h-11 items-center gap-3 border-b border-line py-3 text-ink no-underline">
                <ScoreBadge score={w.myAvg} size={44} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="text-[15px] font-bold">{w.name}</div>
                  <div className="truncate text-[13px] text-muted">{[w.winery, w.mainGrape, w.region].filter(Boolean).join(' · ')}</div>
                </div>
                <IconNext size={18} className="flex-none text-muted" />
              </Link>
            ))}
            {hits?.length === 0 && <div className="py-3.5 text-sm text-muted">Kein Treffer im Katalog.</div>}
            <Link to={`/wein/neu?name=${encodeURIComponent(q.trim())}`} className="flex min-h-11 items-center gap-2.5 pt-3.5 pb-2.5 text-[15px] font-bold text-berry no-underline">
              <span className="flex size-9 items-center justify-center rounded-full bg-rose-badge">
                <IconPlus size={18} />
              </span>
              Nicht dabei? Wein neu anlegen
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 pt-5">
        <Link to="/decider" className="flex items-center gap-4 rounded-[28px] bg-hero px-5 py-[22px] text-white no-underline">
          <span className="flex size-[52px] flex-none items-center justify-center rounded-[18px] bg-white/15">
            <IconScale size={26} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[17px] font-extrabold">Im Restaurant unschlüssig?</span>
            <span className="text-sm font-medium opacity-90">Weine von der Karte vergleichen</span>
          </span>
          <IconNext size={20} />
        </Link>

        <Card className="pb-1">
          <CardTitle
            right={
              recent.data && recent.data.length > 0 ? (
                <Link to="/ich" className="text-sm font-bold no-underline">
                  Alle {recent.data.length}
                </Link>
              ) : undefined
            }
          >
            Zuletzt bewertet
          </CardTitle>
          <div className="pt-3">
            {recent.data && recent.data.length === 0 && (
              <div className="border-t border-line py-4 text-sm text-muted">Noch keine Bewertung. Suche oben nach deinem ersten Wein.</div>
            )}
            {latest.map((r) => (
              <Link key={r.id} to={`/wein/${r.wineId}`} className="flex items-center gap-3.5 border-t border-line py-3.5 text-ink no-underline">
                <ScoreBadge score={r.score} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="text-[15px] font-bold">{r.wineName}</div>
                  <div className="truncate text-[13px] text-muted">{[r.winery, formatDate(r.tastedOn)].filter(Boolean).join(' · ')}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  )
}
