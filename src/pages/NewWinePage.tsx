import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { WineHit, WineType } from '../lib/types'
import { normalize } from '../lib/text'
import { resizeImage } from '../lib/util'
import { useApp } from '../App'
import { Card, Field, FormHeader, Page, PrimaryButton, Segmented, TextInput } from '../components/ui'
import { IconCamera, IconCheck, IconClose, IconInfo, IconNext } from '../components/Icons'

export default function NewWinePage() {
  const [params] = useSearchParams()
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
  const [photo, setPhoto] = useState<File | null>(null)
  const [similar, setSimilar] = useState<WineHit[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Mögliche Dubletten schon beim Tippen anzeigen
  useEffect(() => {
    if (name.trim().length < 3) {
      setSimilar([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      api.findSimilarWines(name, winery).then((r) => alive && setSimilar(r)).catch(() => undefined)
    }, 400)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [name, winery])

  const gq = normalize(grapeQuery)
  const grapeHits = gq
    ? grapes.filter((g) => !grapeIds.includes(g.id) && normalize([g.name, ...g.synonyms].join(' ')).includes(gq)).slice(0, 6)
    : []

  const save = async () => {
    if (!name.trim()) {
      setError('Bitte gib den Namen des Weins ein.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const id = await api.createWine({
        name: name.trim(),
        winery: winery.trim() || null,
        country: country.trim() || null,
        region: region.trim() || null,
        type,
        priceClass: price,
        grapeIds,
      })
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

  return (
    <Page nav={false}>
      <FormHeader title="Wein neu anlegen" sub="Nicht im Katalog gefunden" />

      <div className="flex flex-col gap-4 px-4 pt-4">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-[180px] flex-col items-center justify-center gap-2.5 rounded-[28px] border-2 border-dashed border-dash bg-card">
          <span className="flex size-[60px] items-center justify-center rounded-[20px] bg-rose-badge text-berry">{photo ? <IconCheck size={30} /> : <IconCamera size={30} />}</span>
          <span className="text-base font-bold">{photo ? 'Foto ausgewählt' : 'Etikett fotografieren'}</span>
          <span className="text-[13px] text-muted">{photo ? photo.name : 'Optional. Hilft beim Wiederfinden.'}</span>
        </button>

        <Card className="flex flex-col gap-4">
          <Field label="Name des Weins" htmlFor="name">
            <TextInput id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Rosso di Casa" autoComplete="off" />
          </Field>
          <Field label="Weingut" htmlFor="weingut">
            <TextInput id="weingut" value={winery} onChange={(e) => setWinery(e.target.value)} placeholder="z. B. Agriturismo Esempio" autoComplete="off" />
          </Field>

          {similar.length > 0 && (
            <div className="flex flex-col gap-1 rounded-[20px] bg-rose-badge px-4 py-3.5">
              <div className="text-[13px] font-bold text-berry-dark">Ähnlicher Wein im Katalog</div>
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
              <TextInput id="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Toskana" />
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

        <div className="flex items-start gap-3 px-1">
          <IconInfo size={20} className="mt-px flex-none text-muted" />
          <div className="text-[13px] leading-normal text-ink-2">Der Wein ist sofort bewertbar. Doppelte Einträge prüft der Admin später und führt sie zusammen.</div>
        </div>

        {error && <div role="alert" className="rounded-2xl bg-rose-badge px-4 py-3 text-sm font-semibold text-berry-dark">{error}</div>}

        <PrimaryButton onClick={save} disabled={busy}>
          {busy ? 'Wird angelegt …' : 'Anlegen und bewerten'}
          <IconNext size={20} />
        </PrimaryButton>
      </div>
    </Page>
  )
}
