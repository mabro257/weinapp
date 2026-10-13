import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate, formatMonth, normalize } from '../lib/text'
import { useAsync } from '../lib/util'
import { Card, ErrorBox, FormHeader, Loading, Page, ScoreBadge, TagChip } from '../components/ui'
import { IconClose, IconLock, IconSearch } from '../components/Icons'

const TAGS_SHORT = 8

/** Alle eigenen Bewertungen mit Suche und Filter nach Ort/Anlass */
export default function RatingsPage() {
  const res = useAsync(() => api.myRatings(), [])
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [allTags, setAllTags] = useState(false)

  const all = res.data ?? []
  const tagList = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of all) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
  }, [all])

  const nq = normalize(q)
  const list = all.filter(
    (r) =>
      (!tag || r.tags.includes(tag)) &&
      (!nq || normalize([r.wineName, r.winery, r.region, r.note, ...r.tags].filter(Boolean).join(' ')).includes(nq)),
  )
  const visibleTags = allTags ? tagList : tagList.slice(0, TAGS_SHORT)
  let lastMonth = ''

  return (
    <Page>
      <FormHeader title="Meine Bewertungen" sub={res.data ? `${all.length} Bewertungen` : undefined} fallback="/ich" />
      {res.error && <ErrorBox message={res.error} />}

      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="flex h-[52px] items-center gap-2.5 rounded-full bg-card pr-1.5 pl-[18px]">
          <IconSearch size={20} className="flex-none text-muted" />
          <label htmlFor="vsuche" className="sr-only">Bewertungen durchsuchen</label>
          <input id="vsuche" type="search" placeholder="Wein, Ort, Anlass oder Notiz" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden" />
          {q && (
            <button type="button" aria-label="Suche leeren" onClick={() => setQ('')} className="flex size-10 flex-none items-center justify-center rounded-full bg-chip text-ink-2">
              <IconClose size={16} />
            </button>
          )}
        </div>

        {tagList.length > 0 && (
          <Card className="flex flex-col gap-2.5 p-4">
            <div className="text-[13px] font-bold text-muted">Ort oder Anlass</div>
            <div role="group" aria-label="Nach Ort oder Anlass filtern" className="flex flex-wrap gap-2">
              {visibleTags.map(([t, n]) => {
                const on = t === tag
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTag(on ? null : t)}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] ${on ? 'bg-berry font-bold text-white' : 'bg-chip font-semibold text-ink-2'}`}
                  >
                    {t}
                    <span className={on ? 'opacity-80' : 'text-muted'}>{n}</span>
                  </button>
                )
              })}
            </div>
            {tagList.length > TAGS_SHORT && (
              <button type="button" onClick={() => setAllTags((v) => !v)} className="min-h-9 self-start text-[13px] font-bold text-berry">
                {allTags ? 'Weniger anzeigen' : `Alle ${tagList.length} anzeigen`}
              </button>
            )}
          </Card>
        )}

        <Card className="px-5 pt-2 pb-1">
          {res.loading && !res.data && <Loading />}
          {res.data && list.length === 0 && <div className="py-[18px] text-sm text-muted">{all.length ? 'Keine passenden Bewertungen.' : 'Noch keine Bewertung erfasst.'}</div>}
          {list.map((r, i) => {
            const month = formatMonth(r.tastedOn)
            const showMonth = month !== lastMonth
            lastMonth = month
            const last = i === list.length - 1
            return (
              <div key={r.id}>
                {showMonth && <div className="pt-3.5 pb-1 text-[13px] font-extrabold text-muted">{month}</div>}
                <Link to={`/wein/${r.wineId}`} className={`flex gap-3.5 py-3.5 text-ink no-underline ${last ? '' : 'border-b border-line'}`}>
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
      </div>
    </Page>
  )
}
