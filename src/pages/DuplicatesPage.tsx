import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { DuplicatePair } from '../lib/types'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { Card, ErrorBox, FormHeader, Page } from '../components/ui'
import { IconCheck } from '../components/Icons'

const SOURCE: Record<string, string> = { import: 'Katalog', manuell: 'selbst angelegt', demo: 'Beispiel' }

/** Admin: mögliche Dubletten prüfen und zusammenführen */
export default function DuplicatesPage() {
  const { profile } = useApp()
  const res = useAsync(() => (profile.isAdmin ? api.duplicateCandidates() : Promise.resolve([])), [profile.isAdmin])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!profile.isAdmin) return <Page><FormHeader title="Dubletten prüfen" /><ErrorBox message="Nur für Admins." /></Page>

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      res.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const side = (w: DuplicatePair['a']) => (
    <Link to={`/wein/${w.id}`} className="flex min-w-0 flex-col gap-0.5 rounded-[18px] bg-chip px-3.5 py-3 text-ink no-underline">
      <span className="text-[15px] font-bold">{w.name}</span>
      <span className="truncate text-[13px] text-ink-2">{w.winery ?? 'ohne Weingut'}</span>
      <span className="text-xs font-semibold text-muted">
        {SOURCE[w.source] ?? w.source} · {w.ratings} {w.ratings === 1 ? 'Bewertung' : 'Bewertungen'}
      </span>
    </Link>
  )

  return (
    <Page>
      <FormHeader title="Dubletten prüfen" sub="Selbst angelegte und bewertete Weine" fallback="/ich" />
      {error && <ErrorBox message={error} />}
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className={`text-[13px] leading-normal text-ink-2 ${(res.data?.length ?? 0) > 0 ? '' : 'hidden'}`}>
          Beim Zusammenführen ziehen Bewertungen, Merkliste, Weinabende, Empfehlungen und das Etikettfoto zum behaltenen Wein um. Behalte möglichst den Katalogeintrag.
        </div>
        {res.loading && !res.data && <div className="py-8 text-center text-sm font-semibold text-muted">Suche nach Dubletten …</div>}
        {res.error && !res.loading && (
          <Card className="flex flex-col gap-3">
            <div className="text-[15px] font-bold">Die Prüfung hat nicht geklappt</div>
            <div className="text-[13px] leading-snug text-ink-2">{res.error}</div>
            <button type="button" onClick={res.reload} className="min-h-11 self-start rounded-full bg-berry px-5 text-sm font-bold text-white">Nochmal versuchen</button>
          </Card>
        )}
        {!res.loading && !res.error && res.data?.length === 0 && (
          <Card className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-rose-badge text-berry"><IconCheck size={24} /></span>
            <div className="text-[17px] font-extrabold">Keine Dubletten vorhanden</div>
            <div className="text-[13px] text-muted">Alle selbst angelegten und bewerteten Weine sind eindeutig.</div>
          </Card>
        )}
        {res.data?.map((p) => {
          const key = `${p.a.id}-${p.b.id}`
          return (
            <Card key={key} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted">Ähnlichkeit {Math.round(p.score * 100)} %</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {side(p.a)}
                {side(p.b)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy !== null} onClick={() => run(key, () => api.mergeWines(p.b.id, p.a.id))} className="min-h-11 rounded-full bg-berry px-3 text-[13px] font-bold text-white disabled:opacity-50">
                  Links behalten
                </button>
                <button type="button" disabled={busy !== null} onClick={() => run(key, () => api.mergeWines(p.a.id, p.b.id))} className="min-h-11 rounded-full bg-berry px-3 text-[13px] font-bold text-white disabled:opacity-50">
                  Rechts behalten
                </button>
              </div>
              <button type="button" disabled={busy !== null} onClick={() => run(key, () => api.dismissDuplicate(p.a.id, p.b.id))} className="min-h-11 rounded-full bg-chip text-[13px] font-bold text-ink-2 disabled:opacity-50">
                {busy === key ? 'Speichert …' : 'Kein Duplikat'}
              </button>
            </Card>
          )
        })}
      </div>
    </Page>
  )
}
