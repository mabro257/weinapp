import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { TASTE, scoreWord, tasteWord, todayIso, type TasteKey } from '../lib/text'
import { resizeImage, useAsync } from '../lib/util'
import { Card, CardTitle, ErrorBox, FormHeader, Hint, Loading, Page, PrimaryButton, TextInput } from '../components/ui'
import { IconCamera, IconCheck, IconClose, IconMinus, IconPin, IconPlus } from '../components/Icons'

export default function RatePage() {
  const wineId = Number(useParams().id)
  const navigate = useNavigate()
  const res = useAsync(async () => {
    const [wine, tags] = await Promise.all([api.getWine(wineId), api.myTags()])
    return { wine, tags }
  }, [wineId])

  const [score, setScore] = useState(85)
  const [vintage, setVintage] = useState('')
  const [date, setDate] = useState(todayIso())
  const [taste, setTaste] = useState<Record<TasteKey, number | null>>({ body: null, acidity: null, tannin: null })
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (res.loading && !res.data) return <Page nav={false}><Loading /></Page>
  if (res.error) return <Page nav={false}><ErrorBox message={res.error} /></Page>
  const wine = res.data?.wine
  if (!wine) return <Page nav={false}><ErrorBox message="Wein nicht gefunden." /></Page>

  const clamp = (v: number) => Math.max(1, Math.min(100, v))
  // Reihenfolge stabil halten: bekannte Tags zuerst, neu getippte hinten anhängen
  const knownTags = [...new Set([...(res.data?.tags ?? []).slice(0, 12), ...tags])]
  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
  const addTag = () => {
    const t = newTag.trim()
    if (t && !tags.includes(t)) setTags((cur) => [...cur, t])
    setNewTag('')
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const v = vintage.trim() ? Number(vintage) : null
      if (v !== null && (!Number.isInteger(v) || v < 1900 || v > 2100)) throw new Error('Bitte einen gültigen Jahrgang eingeben, z. B. 2021.')
      const pending = newTag.trim()
      await api.createRating({
        wineId,
        score,
        vintage: v,
        tastedOn: date || todayIso(),
        body: taste.body,
        acidity: taste.acidity,
        tannin: taste.tannin,
        note: note.trim() || null,
        tags: pending && !tags.includes(pending) ? [...tags, pending] : tags,
      })
      if (photo && !wine.labelUrl) {
        try {
          await api.uploadLabel(wineId, await resizeImage(photo))
        } catch {
          // Bewertung ist gespeichert; ein fehlgeschlagenes Foto soll das nicht verhindern
        }
      }
      navigate(`/wein/${wineId}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Page nav={false}>
      <FormHeader title="Neue Bewertung" sub={[wine.name, wine.winery].filter(Boolean).join(' · ')} closeIcon={<IconClose size={20} />} />

      <div className="flex flex-col gap-4 px-4 pt-4">
        <Card className="flex flex-col gap-3.5">
          <label htmlFor="punkte" className="text-[13px] font-bold text-muted">Gesamtnote</label>
          <div className="flex items-center justify-between gap-3">
            <button type="button" aria-label="Einen Punkt weniger" onClick={() => setScore((s) => clamp(s - 1))} className="flex size-[52px] flex-none items-center justify-center rounded-full bg-chip">
              <IconMinus />
            </button>
            <div className="flex flex-col items-center gap-0.5" aria-live="polite">
              <div className="flex items-baseline gap-1">
                <span className="text-[64px] leading-none font-extrabold text-berry">{score}</span>
                <span className="text-lg font-bold text-muted">/100</span>
              </div>
              <div className="text-[15px] font-bold text-ink-2">{scoreWord(score)}</div>
            </div>
            <button type="button" aria-label="Einen Punkt mehr" onClick={() => setScore((s) => clamp(s + 1))} className="flex size-[52px] flex-none items-center justify-center rounded-full bg-chip">
              <IconPlus />
            </button>
          </div>
          <input id="punkte" type="range" min={1} max={100} step={1} value={score} onChange={(e) => setScore(Number(e.target.value))} className="h-11 w-full cursor-pointer" />
          <div className="flex justify-between text-xs font-semibold text-muted"><span>1</span><span>50</span><span>100</span></div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-[22px] bg-card px-4 py-3.5">
            <label htmlFor="jahrgang" className="text-xs font-bold text-muted">Jahrgang (optional)</label>
            <input id="jahrgang" type="number" inputMode="numeric" placeholder="z. B. 2021" value={vintage} onChange={(e) => setVintage(e.target.value)} className="h-9 w-full border-0 bg-transparent text-[17px] font-bold outline-none" />
          </div>
          <div className="flex flex-col gap-1 rounded-[22px] bg-card px-4 py-3.5">
            <label htmlFor="datum" className="text-xs font-bold text-muted">Verkostet am</label>
            <input id="datum" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className="h-9 w-full min-w-0 border-0 bg-transparent text-base font-bold outline-none" />
          </div>
        </div>

        <Card className="flex flex-col gap-[18px]">
          <CardTitle right={<Hint>optional</Hint>}>Geschmack</CardTitle>
          {(['body', 'acidity', 'tannin'] as TasteKey[]).map((k) => {
            const cur = taste[k]
            return (
              <div key={k} role="group" aria-label={TASTE[k].label} className="flex flex-col gap-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>{TASTE[k].label}</span>
                  <span className="font-medium text-muted">{tasteWord(k, cur)}</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const on = cur !== null && n <= cur
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={cur === n}
                        aria-label={`${TASTE[k].label} ${n} von 5`}
                        onClick={() => setTaste((t) => ({ ...t, [k]: t[k] === n ? null : n }))}
                        className={`h-11 rounded-full text-[15px] font-bold ${on ? 'bg-berry text-white' : 'bg-chip text-ink-2'}`}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted"><span>{TASTE[k].low}</span><span>{TASTE[k].high}</span></div>
              </div>
            )
          })}
        </Card>

        <Card className="flex flex-col gap-3.5">
          <CardTitle right={<Hint>optional</Hint>}>Ort oder Anlass</CardTitle>
          <div className="flex gap-2">
            <label htmlFor="anlass" className="sr-only">Neuer Ort oder Anlass</label>
            <TextInput
              id="anlass"
              placeholder="Neuer Ort oder Anlass"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
            />
            <button type="button" aria-label="Ort oder Anlass hinzufügen" onClick={addTag} className="flex size-12 flex-none items-center justify-center rounded-full bg-rose-badge text-berry">
              <IconPlus size={20} />
            </button>
          </div>
          {knownTags.length > 0 && (
            <>
              <div className="text-xs font-bold text-muted">Zuletzt verwendet</div>
              <div className="flex flex-wrap gap-2">
                {knownTags.map((t) => {
                  const on = tags.includes(t)
                  return (
                    <button key={t} type="button" aria-pressed={on} onClick={() => toggleTag(t)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${on ? 'bg-berry text-white' : 'bg-chip text-ink-2'}`}>
                      <IconPin />
                      {t}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-2.5">
          <label htmlFor="notiz" className="text-lg font-bold">Notiz</label>
          <textarea id="notiz" rows={3} placeholder="Was ist dir aufgefallen?" value={note} onChange={(e) => setNote(e.target.value)} className="resize-y rounded-[18px] border-0 bg-chip px-4 py-3.5 text-base leading-snug outline-none" />
        </Card>

        {!wine.labelUrl && (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-3.5 rounded-[28px] border-2 border-dashed border-dash px-5 py-[18px] text-left">
              <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-rose-badge text-berry">{photo ? <IconCheck /> : <IconCamera size={24} />}</span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-bold">{photo ? 'Foto ausgewählt' : 'Etikett fotografieren'}</span>
                <span className="text-[13px] text-muted">{photo ? 'Tippen, um ein anderes Foto zu wählen.' : 'Optional. Dieser Wein hat noch kein Bild.'}</span>
              </span>
            </button>
          </>
        )}

        {error && <div role="alert" className="rounded-2xl bg-rose-badge px-4 py-3 text-sm font-semibold text-berry-dark">{error}</div>}

        <PrimaryButton onClick={save} disabled={busy}>
          <IconCheck size={20} />
          {busy ? 'Speichert …' : 'Bewertung speichern'}
        </PrimaryButton>
      </div>
    </Page>
  )
}
