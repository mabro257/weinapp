import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Group, Member, Wine } from '../lib/types'
import { useApp } from '../App'
import { PrimaryButton } from './ui'

/** Unteres Blatt: Wein an Freunde aus den eigenen Gruppen empfehlen */
export default function RecommendSheet({ wine, myScore, onClose }: { wine: Wine; myScore: number | null; onClose: () => void }) {
  const { profile } = useApp()
  const [groups, setGroups] = useState<{ group: Group; members: Member[] }[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .myGroups()
      .then((gs) => Promise.all(gs.map(async (g) => ({ group: g, members: (await api.groupMembers(g.id)).filter((m) => m.userId !== profile.id) }))))
      .then((r) => alive && setGroups(r))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [profile.id])

  // Escape schließt das Blatt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const people = new Map<string, string>()
  for (const g of groups ?? []) for (const m of g.members) people.set(m.userId, m.displayName)
  const toggle = (id: string) =>
    setSel((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.recommend(wine.id, [...sel], message)
      setDone(true)
      setTimeout(onClose, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Schließen" onClick={onClose} className="absolute inset-0 bg-ink/45" />
      <div role="dialog" aria-modal="true" aria-label="Wein empfehlen" className="relative flex max-h-[90dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card px-5 pt-3" style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>
        <span className="h-[5px] w-11 self-center rounded-full bg-dash" />
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-xl font-extrabold">Wein empfehlen</h2>
          <div className="text-sm text-ink-2">{[wine.name, wine.winery, myScore !== null ? `deine Note ${myScore}` : null].filter(Boolean).join(' · ')}</div>
        </div>

        {groups === null && !error && <div className="text-sm text-muted">Lädt …</div>}
        {groups !== null && people.size === 0 && <div className="text-sm leading-normal text-ink-2">Du bist noch mit niemandem in einer Gruppe. Unter „Freunde" kannst du eine Gruppe anlegen und Freunde einladen.</div>}

        {people.size > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-[13px] font-bold text-muted">An wen?</div>
            <div className="flex flex-wrap gap-2">
              {[...people.entries()].sort((a, b) => a[1].localeCompare(b[1], 'de')).map(([id, name]) => (
                <button key={id} type="button" aria-pressed={sel.has(id)} onClick={() => toggle(id)} className={`min-h-10 rounded-full px-4 text-sm ${sel.has(id) ? 'bg-berry font-bold text-white' : 'bg-chip font-semibold text-ink-2'}`}>
                  {name}
                </button>
              ))}
            </div>
            {groups!.filter((g) => g.members.length > 0).map((g) => (
              <button key={g.group.id} type="button" onClick={() => setSel(new Set([...sel, ...g.members.map((m) => m.userId)]))} className="self-start py-1 text-sm font-bold text-berry">
                Ganze Gruppe „{g.group.name}" auswählen
              </button>
            ))}
          </div>
        )}

        {people.size > 0 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="empfehlung-text" className="text-[13px] font-bold text-muted">Nachricht (optional)</label>
            <textarea id="empfehlung-text" rows={2} maxLength={500} placeholder="Warum sollten sie ihn probieren?" value={message} onChange={(e) => setMessage(e.target.value)} className="resize-none rounded-[18px] border-0 bg-chip px-4 py-3 text-base leading-snug outline-none" />
          </div>
        )}

        {error && <div role="alert" className="rounded-2xl bg-rose-badge px-4 py-3 text-sm font-semibold text-berry-dark">{error}</div>}
        {people.size > 0 && (
          <PrimaryButton onClick={send} disabled={busy || sel.size === 0 || done}>
            {done ? 'Gesendet' : sel.size === 0 ? 'Freunde auswählen' : `An ${sel.size} ${sel.size === 1 ? 'Person' : 'Personen'} senden`}
          </PrimaryButton>
        )}
        <div className="text-center text-xs leading-snug text-muted">Erscheint bei den Freunden unter „Für dich empfohlen".</div>
      </div>
    </div>
  )
}
