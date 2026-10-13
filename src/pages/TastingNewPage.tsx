import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { todayIso } from '../lib/text'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { Card, ErrorBox, Field, FormHeader, Loading, Page, PrimaryButton, TextInput } from '../components/ui'
import { IconCheck } from '../components/Icons'

export default function TastingNewPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useApp()
  const groups = useAsync(() => api.myGroups(), [])
  const [groupId, setGroupId] = useState<number | null>(params.get('gruppe') ? Number(params.get('gruppe')) : null)
  const [title, setTitle] = useState(`Weinabend bei ${profile.displayName}`)
  const [date, setDate] = useState(todayIso())
  // Abgewählte Mitglieder; standardmäßig sind alle dabei
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const list = groups.data ?? []
  const selected = groupId ?? list[0]?.id ?? null
  const members = useAsync(() => (selected ? api.groupMembers(selected) : Promise.resolve([])), [selected])

  if (groups.loading && !groups.data) return <Page nav={false}><Loading /></Page>

  const toggle = (id: string) =>
    setExcluded((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const participants = (members.data ?? []).filter((m) => m.userId === profile.id || !excluded.has(m.userId))

  const create = async () => {
    if (!selected || !title.trim()) return
    setBusy(true)
    setError(null)
    try {
      const id = await api.createTasting(selected, title, date, participants.map((m) => m.userId))
      navigate(`/weinabend/${id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Page nav={false}>
      <FormHeader title="Weinabend starten" sub="Alle bewerten auf dem eigenen Handy" fallback="/freunde" />
      {groups.error && <ErrorBox message={groups.error} />}
      <div className="flex flex-col gap-4 px-4 pt-4">
        {list.length === 0 ? (
          <Card><div className="text-sm text-ink-2">Lege zuerst unter „Freunde" eine Gruppe an.</div></Card>
        ) : (
          <Card className="flex flex-col gap-4">
            <div role="group" aria-label="Gruppe" className="flex flex-col gap-2">
              <div className="text-[13px] font-bold text-ink-2">Mit welcher Gruppe?</div>
              <div className="flex flex-wrap gap-2">
                {list.map((g) => (
                  <button key={g.id} type="button" aria-pressed={g.id === selected} onClick={() => { setGroupId(g.id); setExcluded(new Set()) }} className={`min-h-10 rounded-full px-4 text-sm ${g.id === selected ? 'bg-berry font-bold text-white' : 'bg-chip font-semibold text-ink-2'}`}>
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
            <div role="group" aria-label="Wer ist dabei" className="flex flex-col gap-2">
              <div className="text-[13px] font-bold text-ink-2">Wer ist dabei?</div>
              <div className="flex flex-wrap gap-2">
                {(members.data ?? []).map((m) => {
                  const me = m.userId === profile.id
                  const on = me || !excluded.has(m.userId)
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      aria-pressed={on}
                      disabled={me}
                      onClick={() => toggle(m.userId)}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm ${on ? 'bg-berry font-bold text-white' : 'bg-chip font-semibold text-ink-2'}`}
                    >
                      {on && <IconCheck size={14} />}
                      {me ? 'Du' : m.displayName}
                    </button>
                  )
                })}
              </div>
              <div className="text-xs text-muted">Nur wer dabei ist, sieht den Abend und kann bewerten. Du kannst das später noch ändern.</div>
            </div>
            <Field label="Titel" htmlFor="titel">
              <TextInput id="titel" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
            </Field>
            <Field label="Datum" htmlFor="datum">
              <TextInput id="datum" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <div className="text-[13px] leading-normal text-muted">
              Du bist Gastgeber: Du legst die Weine fest und schaltest sie nacheinander sichtbar, wenn ihr sie probiert. Am Ende deckst du die Bewertungen auf. Bis dahin sieht niemand die Noten der anderen.
            </div>
          </Card>
        )}
        {error && <div role="alert" className="rounded-2xl bg-rose-badge px-4 py-3 text-sm font-semibold text-berry-dark">{error}</div>}
        {list.length > 0 && <PrimaryButton onClick={create} disabled={busy || !title.trim()}>{busy ? 'Wird angelegt …' : 'Weinabend anlegen'}</PrimaryButton>}
      </div>
    </Page>
  )
}
