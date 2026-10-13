import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { WineHit, WineType } from '../lib/types'
import { normalize } from '../lib/text'
import { nameIssues, suggestName } from '../lib/naming'
import { resizeImage, useObjectUrl } from '../lib/util'
import { useApp } from '../App'
import { Card, ErrorBox, Field, FormHeader, Loading, Page, PrimaryButton, Segmented, TextInput } from '../components/ui'
import { IconCamera, IconCheck, IconClose, IconInfo, IconNext } from '../components/Icons'
import { LABEL_RATIO, LabelCamera } from '../components/LabelCamera'

/** Neuen Wein anlegen (/wein/neu) oder Stammdaten korrigieren (/wein/:id/bearbeiten) */
export default function NewWinePage() {
  const [params] = useSearchParams()
  const routeId = useParams().id
  const editId = routeId ? Number(routeId) : null
  const navigate = useNavigate()
  const { grapes } = useApp()

  const [name, setName] = useState(params.get('name') ?? '')
  const [winery, setWinery] = useState('')
  const [type, setType] = useState<WineType | null>('rot')
  const [grapeIds, setGrapeIds] = useState<number[]>([])
  const [grapeQuery, setGrapeQuery] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [price, setPrice] = useState<number | null>(null)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [camera, setCamera] = useState(false)
  const preview = useObjectUrl(photo)
  const [similar, setSimilar] = useState<WineHit[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [askWinery, setAskWinery] = useState(false)
  const [loading, setLoading] = useState(editId !== null)

  // Bearbeiten: vorhandene Stammdaten laden
  useEffect(() => {
    if (editId === null) return
    api
      .getWine(editId)
      .then((w) => {
        if (!w) throw new Error('Wein nicht gefunden.')
        if (!w.editable) throw new Error('Diesen Wein darf nur der Admin ändern.')
        setName(w.name)
        setWinery(w.winery ?? '')
        setType(w.type)
        setGrapeIds(w.grapeIds)
        setCountry(w.country ?? '')
        setRegion(w.region ?? '')
        setPrice(w.priceClass)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [editId])

  // Mögliche Dubletten schon beim Tippen anzeigen
  useEffect(() => {
    if (name.trim().length < 3) {
      setSimilar([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      api
        .findSimilarWines(name, winery)
        .then((r) => alive && setSimilar(r.filter((x) => x.id !== editId)))
        .catch(() => undefined)
    }, 400)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [name, winery, editId])

  const gq = normalize(grapeQuery)
  const grapeHits = gq
    ? grapes.filter((g) => !grapeIds.includes(g.id) && normalize([g.name, ...g.synonyms].join(' ')).includes(gq)).slice(0, 6)
    : []
  const issues = nameIssues(name, winery)
  const suggestion = suggestName(name, winery)
  const mainGrape = grapes.find((g) => g.id === grapeIds[0])?.name

  const save = async () => {
    if (!name.trim()) {
      setError('Bitte gib den Namen des Weins ein.')
      return
    }
    if (!winery.trim() && !askWinery) {
      setAskWinery(true)
      return
    }
    setBusy(true)
    setError(null)
    const input = {
      name: name.trim(),
      winery: winery.trim() || null,
      country: country.trim() || null,
      region: region.trim() || null,
      type,
      priceClass: price,
      grapeIds,
    }
    try {
      if (editId !== null) {
        await api.updateWine(editId, input)
        navigate(`/wein/${editId}`, { replace: true })
        return
      }
      const id = await api.createWine(input)
      if (photo) {
        try {
          await api.uploadLabel(id, await resizeImage(photo))
        } catch {
          // Wein ist angelegt; das Foto kann später bei einer Bewertung nachgereicht werden
        }
      }
      navigate(`/wein/${id}/bewerten`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (loading) return <Page nav={false}><Loading /></Page>
  if (editId !== null && error && !name) return <Page nav={false}><FormHeader title="Wein bearbeiten" /><ErrorBox message={error} /></Page>

  return (
    <Page nav={false}>
      <FormHeader title={editId !== null ? 'Wein bearbeiten' : 'Wein neu anlegen'} sub={editId !== null ? 'Stammdaten korrigieren' : 'Nicht im Katalog gefunden'} />

      <div className="flex flex-col gap-4 px-4 pt-4">
        {editId === null && (
          <>
            {camera && <LabelCamera onClose={() => setCamera(false)} onDone={(b) => { setPhoto(b); setCamera(false) }} />}
            <button type="button" onClick={() => setCamera(true)} className="flex min-h-[180px] flex-col items-center justify-center gap-2.5 rounded-[28px] border-2 border-dashed border-dash bg-card">
              {preview ? (
                <img src={preview} alt="Etikett" className="h-[120px] rounded-[14px] object-cover" style={{ aspectRatio: `${LABEL_RATIO}` }} />
              ) : (
                <span className="flex size-[60px] items-center justify-center rounded-[20px] bg-rose-badge text-berry"><IconCamera size={30} /></span>
              )}
              <span className="text-base font-bold">{photo ? 'Etikett aufgenommen' : 'Etikett fotografieren'}</span>
              <span className="text-[13px] text-muted">{photo ? 'Tippen, um neu aufzunehmen.' : 'Optional. Hilft beim Wiederfinden.'}</span>
            </button>
          </>
        )}

        <div className="flex flex-col gap-2 rounded-[22px] bg-rose-badge px-4 py-3.5 text-[13px] leading-snug text-berry-dark">
          <div className="text-sm font-extrabold">So bleibt der Katalog übersichtlich</div>
          <div><b>Name:</b> wie auf dem Etikett, ohne Weingut und ohne Jahrgang. Steht nur die Rebsorte drauf, ist sie der Name.</div>
          <div><b>Weingut:</b> der Erzeuger, ins eigene Feld.</div>
          <div><b>Jahrgang:</b> gibst du bei der Bewertung an.</div>
          <div className="text-xs opacity-80">Beispiel: Name „I Frati Lugana", Weingut „Cà dei Frati", Rebsorte Turbiana.</div>
        </div>

        <Card className="flex flex-col gap-4">
          <Field label="Name des Weins" htmlFor="name">
            <TextInput id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. I Frati Lugana" autoComplete="off" />
          </Field>
          {issues.length > 0 && (
            <div className="flex flex-col gap-2 rounded-[18px] bg-chip px-3.5 py-3">
              {issues.map((i) => (
                <div key={i.key} className="text-[13px] leading-snug text-ink-2">{i.text}</div>
              ))}
              {suggestion && (
                <button type="button" onClick={() => setName(suggestion)} className="flex min-h-10 items-center gap-1.5 self-start rounded-full bg-card px-3.5 text-left text-[13px] font-bold text-berry">
                  <IconCheck size={16} className="flex-none" />
                  Ändern in „{suggestion}"
                </button>
              )}
            </div>
          )}
          <Field label="Weingut" htmlFor="weingut">
            <TextInput id="weingut" value={winery} onChange={(e) => { setWinery(e.target.value); setAskWinery(false) }} placeholder="z. B. Cà dei Frati" autoComplete="off" />
          </Field>
          {askWinery && !winery.trim() && (
            <div role="alert" className="rounded-[18px] bg-rose-badge px-3.5 py-3 text-[13px] leading-snug font-semibold text-berry-dark">
              Ohne Weingut ist der Wein schwer wiederzufinden und wird leichter doppelt angelegt. Steht es auf dem Etikett, trag es bitte ein. Sonst tippe nochmal auf Speichern.
            </div>
          )}

          {similar.length > 0 && (
            <div className="flex flex-col gap-1 rounded-[20px] bg-rose-badge px-4 py-3.5">
              <div className="text-[13px] font-bold text-berry-dark">Gibt es schon? Dann bitte diesen nehmen:</div>
              {similar.map((s) => (
                <Link key={s.id} to={`/wein/${s.id}`} className="flex min-h-11 items-center justify-between gap-2.5 text-ink no-underline">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{s.name}</span>
                    <span className="truncate text-[13px] text-ink-2">{[s.winery, s.mainGrape].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="flex flex-none items-center gap-1 text-sm font-bold text-berry">Diesen nehmen <IconNext size={16} /></span>
                </Link>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="text-[13px] font-bold text-ink-2">Typ</div>
            <Segmented
              label="Weintyp"
              value={type}
              onChange={setType}
              options={[
                { value: 'rot', label: 'Rot' },
                { value: 'weiss', label: 'Weiß' },
                { value: 'rose', label: 'Rosé' },
                { value: 'schaum', label: 'Schaum' },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="rebsorte" className="text-[13px] font-bold text-ink-2">Rebsorten</label>
            {grapeIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {grapeIds.map((id, i) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={`${grapes.find((g) => g.id === id)?.name} entfernen`}
                    onClick={() => setGrapeIds((cur) => cur.filter((x) => x !== id))}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] ${i === 0 ? 'bg-berry font-bold text-white' : 'bg-chip font-semibold text-ink-2'}`}
                  >
                    {grapes.find((g) => g.id === id)?.name}
                    {i === 0 ? ' · Haupt' : ''}
                    <IconClose size={14} />
                  </button>
                ))}
              </div>
            )}
            <TextInput id="rebsorte" value={grapeQuery} onChange={(e) => setGrapeQuery(e.target.value)} placeholder="Rebsorte suchen, z. B. Merlot" autoComplete="off" />
            {grapeHits.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {grapeHits.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setGrapeIds((cur) => [...cur, g.id])
                      setGrapeQuery('')
                    }}
                    className="min-h-10 rounded-full border-2 border-dashed border-dash px-3.5 text-[13px] font-bold text-berry"
                  >
                    + {g.name}
                  </button>
                ))}
              </div>
            )}
            {gq && grapeHits.length === 0 && <div className="text-xs text-muted">Keine passende Rebsorte gefunden. Fehlt eine, kann der Admin sie ergänzen.</div>}
            <div className="text-xs leading-snug text-muted">Die erste Rebsorte zählt als Hauptrebsorte für Glossar und Decider. Antippen entfernt sie.</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Land" htmlFor="land">
              <TextInput id="land" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Italien" />
            </Field>
            <Field label="Region" htmlFor="region">
              <TextInput id="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Lugana" />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[13px] font-bold text-ink-2">Preisklasse (optional)</div>
            <Segmented
              label="Preisklasse"
              allowClear
              value={price}
              onChange={setPrice}
              options={[
                { value: 1, label: '€' },
                { value: 2, label: '€€' },
                { value: 3, label: '€€€' },
                { value: 4, label: '€€€€' },
              ]}
            />
            <div className="text-xs text-muted">€ bis 10 € · €€ bis 25 € · €€€ bis 50 € · €€€€ darüber (Ladenpreis)</div>
          </div>
        </Card>

        {name.trim() && (
          <div className="flex flex-col gap-1 rounded-[22px] bg-card px-4 py-3.5">
            <div className="text-xs font-bold text-muted">So erscheint der Wein in der Suche</div>
            <div className="text-[15px] font-extrabold">{name.trim()}</div>
            <div className="text-[13px] text-muted">{[winery.trim() || 'Weingut fehlt', mainGrape, region.trim()].filter(Boolean).join(' · ')}</div>
          </div>
        )}

        <div className="flex items-start gap-3 px-1">
          <IconInfo size={20} className="mt-px flex-none text-muted" />
          <div className="text-[13px] leading-normal text-ink-2">
            {editId !== null
              ? 'Änderungen gelten für alle, die diesen Wein bewertet haben.'
              : 'Der Wein ist sofort bewertbar. Doppelte Einträge prüft der Admin und führt sie zusammen.'}
          </div>
        </div>

        {error && <div role="alert" className="rounded-2xl bg-rose-badge px-4 py-3 text-sm font-semibold text-berry-dark">{error}</div>}

        <PrimaryButton onClick={save} disabled={busy}>
          {busy ? 'Speichert …' : editId !== null ? 'Änderungen speichern' : askWinery && !winery.trim() ? 'Ohne Weingut anlegen' : 'Anlegen und bewerten'}
          <IconNext size={20} />
        </PrimaryButton>
      </div>
    </Page>
  )
}
