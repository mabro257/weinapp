import { useCallback, useEffect, useState } from 'react'
import type { RatingWithWine } from './types'

/** Lädt Daten asynchron; reload() lädt neu. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fn()
      .then((d) => {
        if (alive) {
          setData(d)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}

/** Vorschau-Adresse für ein Foto, wird beim Wechsel wieder freigegeben. */
export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

/** Verkleinert ein Foto im Browser auf max. 800 px Breite und speichert es als WebP. */
export async function resizeImage(file: Blob, maxWidth = 800): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.8))
  if (blob && blob.type === 'image/webp') return blob
  // Fallback für ältere Safari-Versionen ohne WebP-Export
  const jpeg = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
  if (!jpeg) throw new Error('Bild konnte nicht verarbeitet werden')
  return jpeg
}

/** Eigene Bewertungen als CSV-Datei herunterladen (Excel-tauglich mit Semikolon). */
export function downloadCsv(rows: RatingWithWine[]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = ['Datum', 'Wein', 'Weingut', 'Region', 'Land', 'Jahrgang', 'Punkte', 'Körper', 'Säure', 'Tannin', 'Ort/Anlass', 'Notiz']
  const lines = rows.map((r) =>
    [r.tastedOn, r.wineName, r.winery, r.region, r.country, r.vintage, r.score, r.body, r.acidity, r.tannin, r.tags.join(', '), r.note]
      .map(esc)
      .join(';'),
  )
  const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `meine-weinbewertungen-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
