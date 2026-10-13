import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { mean } from '../lib/stats'
import { downloadCsv, useAsync } from '../lib/util'
import { resetDemo } from '../lib/mockApi'
import { useApp } from '../App'
import { Card, ErrorBox, Page, PageTitle, WineThumb } from '../components/ui'
import { IconBookmark, IconDownload, IconGlass, IconLogout, IconMedal, IconNext } from '../components/Icons'

export default function HistoryPage() {
  const { profile, refreshProfile } = useApp()
  const res = useAsync(() => api.myRatings(), [])
  const saved = useAsync(() => api.savedWines(), [])
  const [editName, setEditName] = useState(false)
  const [name, setName] = useState(profile.displayName)

  const all = res.data ?? []
  const avg = mean(all.map((r) => r.score))
  const grapeCount = new Set(all.flatMap((r) => (r.mainGrapeId === null ? [] : [r.mainGrapeId]))).size

  return (
    <Page>
      <PageTitle title="Ich" />
      {res.error && <ErrorBox message={res.error} />}

      <div className="flex flex-col gap-4 px-4 pt-5">
        <Link to="/ich/bewertungen" className="flex flex-col gap-3.5 rounded-[28px] bg-hero p-5 text-white no-underline">
          <span className="flex items-center justify-between">
            <span className="text-lg font-extrabold">Meine Bewertungen</span>
            <IconNext size={20} />
          </span>
          <span className="grid grid-cols-3 gap-2">
            {[
              [res.data ? String(all.length) : '…', 'Bewertungen'],
              [avg === null ? '–' : String(Math.round(avg)), 'Ø Note'],
              [String(grapeCount), 'Rebsorten'],
            ].map(([v, l]) => (
              <span key={l} className="flex flex-col gap-0.5 rounded-[18px] bg-white/15 px-2 py-2.5 text-center">
                <span className="text-2xl font-extrabold">{v}</span>
                <span className="text-xs font-semibold opacity-90">{l}</span>
              </span>
            ))}
          </span>
          <span className="text-[13px] font-semibold opacity-90">Alle ansehen, durchsuchen und nach Ort oder Anlass filtern</span>
        </Link>

        <Link to="/abzeichen" className="flex items-center gap-3.5 rounded-[22px] bg-card px-4 py-3.5 text-ink no-underline">
          <span className="flex size-10 flex-none items-center justify-center rounded-full bg-berry text-white"><IconMedal size={22} /></span>
          <span className="flex-1 text-[15px] font-bold">Meine Abzeichen</span>
          <IconNext size={18} className="text-muted" />
        </Link>

        {profile.isAdmin && (
          <Link to="/dubletten" className="flex items-center gap-3.5 rounded-[22px] bg-card px-4 py-3.5 text-ink no-underline">
            <span className="flex size-10 flex-none items-center justify-center rounded-full bg-rose-badge text-berry"><IconGlass size={22} /></span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-bold">Dubletten prüfen</span>
              <span className="text-xs text-muted">Admin: doppelte Weine zusammenführen</span>
            </span>
            <IconNext size={18} className="text-muted" />
          </Link>
        )}

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
