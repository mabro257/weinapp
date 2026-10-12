import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { normalize } from '../lib/text'
import { STYLE_ORDER, styleOf } from '../lib/taste'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { Card, FormHeader, Page, Segmented } from '../components/ui'
import type { Grape } from '../lib/types'

/** Rebsorten-Glossar: nach Farbe und Stilgruppe geordnet, seltene Sorten nur über die Suche */
export default function GrapesPage() {
  const { grapes } = useApp()
  const mine = useAsync(() => api.myRatings(), [])
  const [q, setQ] = useState('')
  const [color, setColor] = useState<'rot' | 'weiss'>('rot')

  const counts = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of mine.data ?? []) if (r.mainGrapeId !== null) m.set(r.mainGrapeId, (m.get(r.mainGrapeId) ?? 0) + 1)
    return m
  }, [mine.data])

  const nq = normalize(q)
  const searchHits = nq
    ? grapes
        .filter((g) => normalize([g.name, ...g.synonyms].join(' ')).includes(nq))
        .sort((a, b) => Number(b.short !== null) - Number(a.short !== null) || a.name.localeCompare(b.name, 'de'))
        .slice(0, 40)
    : []

  const groups = STYLE_ORDER[color].map((style) => ({
    style,
    items: grapes.filter((g) => g.color === color && g.short && styleOf(g) === style).sort((a, b) => a.name.localeCompare(b.name, 'de')),
  }))
  const glossaryCount = grapes.filter((g) => g.short).length
  const rareCount = grapes.length - glossaryCount

  const row = (g: Grape) => {
    const n = counts.get(g.id) ?? 0
    return (
      <Link key={g.id} to={`/rebsorten/${g.id}`} className="flex min-h-11 items-center justify-between gap-3 border-t border-line py-3 text-ink no-underline">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-bold">{g.name}</span>
          {g.synonyms.length > 0 && <span className="truncate text-xs text-muted">auch: {g.synonyms.join(', ')}</span>}
          {!g.short && <span className="text-xs text-muted">seltene Sorte, ohne Glossartext</span>}
        </span>
        <span className="flex-none text-[13px] font-semibold text-muted">{n === 0 ? '' : `${n} ${n === 1 ? 'Bewertung' : 'Bewertungen'}`}</span>
      </Link>
    )
  }

  return (
    <Page>
      <FormHeader title="Rebsorten-Glossar" sub={`${glossaryCount} Rebsorten mit Beschreibung`} />
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="flex h-[52px] items-center rounded-full bg-card px-[18px]">
          <label htmlFor="rsuche" className="sr-only">Rebsorte suchen</label>
          <input id="rsuche" type="search" placeholder="Rebsorte suchen, auch Synonyme wie Lugana" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base outline-none" />
        </div>

        {nq ? (
          <Card className="pb-1">
            <h2 className="m-0 mb-2 text-lg font-bold">Suchergebnis</h2>
            {searchHits.length === 0 && <div className="border-t border-line py-4 text-sm text-muted">Keine Rebsorte gefunden.</div>}
            {searchHits.map(row)}
          </Card>
        ) : (
          <>
            <Segmented label="Weinfarbe" value={color} onChange={(v) => v && setColor(v)} options={[{ value: 'rot', label: 'Rotweinsorten' }, { value: 'weiss', label: 'Weißweinsorten' }]} />
            {groups.map((grp) =>
              grp.items.length ? (
                <Card key={grp.style} className="pb-1">
                  <h2 className="m-0 mb-2 text-lg font-bold">{grp.style}</h2>
                  {grp.items.map(row)}
                </Card>
              ) : null,
            )}
            {rareCount > 0 && <p className="m-0 px-1 text-[13px] leading-normal text-muted">Dazu {rareCount} seltene Sorten aus dem Katalog ohne Glossartext. Du findest sie über die Suche oben.</p>}
          </>
        )}
      </div>
    </Page>
  )
}
