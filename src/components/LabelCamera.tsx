import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCheck, IconClose } from './Icons'

/** Seitenverhältnis des Etikett-Rahmens (Breite / Höhe), passend zu den Vorschaubildern. */
export const LABEL_RATIO = 4 / 5

/** Schneidet einen Bildausschnitt mittig auf das Etikett-Format zu (für Fotos aus der Galerie). */
export async function cropToLabel(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  let w = bmp.width
  let h = bmp.height
  if (w / h > LABEL_RATIO) w = Math.round(h * LABEL_RATIO)
  else h = Math.round(w / LABEL_RATIO)
  return drawToBlob(bmp, (bmp.width - w) / 2, (bmp.height - h) / 2, w, h)
}

async function drawToBlob(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw)
  canvas.height = Math.round(sh)
  canvas.getContext('2d')!.drawImage(src, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
  if (!blob) throw new Error('Bild konnte nicht verarbeitet werden')
  return blob
}

/**
 * Vollbild-Kamera mit Etikett-Rahmen. Das Foto wird automatisch auf den Rahmen zugeschnitten,
 * damit alle Etikettbilder gleich aussehen. Ohne Kamerazugriff bleibt die Auswahl aus der Galerie.
 */
export function LabelCamera({ onDone, onClose }: { onDone: (photo: Blob) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'start' | 'live' | 'error'>('start')
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let alive = true
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } } })
      .then((s) => {
        if (!alive) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const v = videoRef.current!
        v.srcObject = s
        v.play().catch(() => undefined)
        setStatus('live')
      })
      .catch(() => alive && setStatus('error'))
    // Seite darunter nicht mitscrollen
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      alive = false
      stream?.getTracks().forEach((t) => t.stop())
      document.body.style.overflow = overflow
    }
  }, [])

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url)
  }, [shot])

  const capture = async () => {
    const v = videoRef.current
    const f = frameRef.current
    if (!v || !f || !v.videoWidth) return
    // Rahmen von Bildschirm- in Videokoordinaten umrechnen (Video füllt den Bildschirm, object-fit: cover)
    const vr = v.getBoundingClientRect()
    const fr = f.getBoundingClientRect()
    const scale = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight)
    const offX = (v.videoWidth * scale - vr.width) / 2
    const offY = (v.videoHeight * scale - vr.height) / 2
    const sx = Math.max(0, (fr.left - vr.left + offX) / scale)
    const sy = Math.max(0, (fr.top - vr.top + offY) / scale)
    const sw = Math.min(v.videoWidth - sx, fr.width / scale)
    const sh = Math.min(v.videoHeight - sy, fr.height / scale)
    const blob = await drawToBlob(v, sx, sy, sw, sh)
    setShot({ blob, url: URL.createObjectURL(blob) })
  }

  const fromGallery = async (file: File | undefined) => {
    if (!file) return
    const blob = await cropToLabel(file)
    setShot({ blob, url: URL.createObjectURL(blob) })
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Etikett fotografieren" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 size-full object-cover ${shot ? 'invisible' : ''}`} />

        {/* Etikett-Silhouette: alles außerhalb wird abgedunkelt */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[14%] pt-16 pb-8">
          <div
            ref={frameRef}
            className="relative w-full max-w-[340px] rounded-[18px]"
            style={{ aspectRatio: `${LABEL_RATIO}`, boxShadow: shot ? 'none' : '0 0 0 100vmax rgba(0,0,0,0.6)' }}
          >
            {shot ? (
              <img src={shot.url} alt="Aufgenommenes Etikett" className="size-full rounded-[18px] object-cover" />
            ) : (
              <>
                <div className="absolute inset-0 rounded-[18px] border-2 border-white/70" />
                {/* Ecken als Ausrichtungshilfe */}
                <span className="absolute -top-1 -left-1 size-8 rounded-tl-[20px] border-t-4 border-l-4 border-white" />
                <span className="absolute -top-1 -right-1 size-8 rounded-tr-[20px] border-t-4 border-r-4 border-white" />
                <span className="absolute -bottom-1 -left-1 size-8 rounded-bl-[20px] border-b-4 border-l-4 border-white" />
                <span className="absolute -right-1 -bottom-1 size-8 rounded-br-[20px] border-r-4 border-b-4 border-white" />
                {/* Mittellinie: Etikett gerade ausrichten */}
                <span className="absolute top-1/2 left-1/2 h-px w-10 -translate-x-1/2 bg-white/50" />
              </>
            )}
          </div>
        </div>

        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))]">
          <button type="button" aria-label="Schließen" onClick={onClose} className="flex size-11 items-center justify-center rounded-full bg-black/50">
            <IconClose size={20} />
          </button>
          <span className="text-sm font-bold">Etikett fotografieren</span>
          <span className="size-11" />
        </div>

        {status === 'start' && !shot && <div className="absolute inset-x-0 top-1/2 text-center text-sm font-semibold">Kamera startet …</div>}
        {status === 'error' && !shot && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-[22px] bg-black/80 px-5 py-4 text-center text-sm leading-snug">
            Kein Zugriff auf die Kamera. Erlaube den Kamerazugriff in den Einstellungen oder wähle ein Foto aus der Galerie.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="text-center text-[13px] leading-snug text-white/80">
          {shot ? 'Ist das Etikett gut lesbar?' : 'Vorderes Etikett gerade und formatfüllend in den Rahmen.'}
        </div>
        {shot ? (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setShot(null)} className="min-h-[52px] rounded-full bg-white/15 text-[15px] font-bold">
              Nochmal
            </button>
            <button type="button" onClick={() => onDone(shot.blob)} className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-berry">
              <IconCheck size={20} />
              Verwenden
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 items-center">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => fromGallery(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} className="justify-self-start rounded-full bg-white/15 px-4 py-2.5 text-[13px] font-bold">
              Galerie
            </button>
            <button
              type="button"
              aria-label="Foto aufnehmen"
              disabled={status !== 'live'}
              onClick={capture}
              className="size-[72px] justify-self-center rounded-full border-4 border-white bg-white/90 ring-4 ring-black disabled:opacity-40"
            />
            <span />
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
