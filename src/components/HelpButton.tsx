import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { HelpText } from '../lib/text'
import { IconClose } from './Icons'

/** Kleines Fragezeichen, öffnet eine Erklärung als Blatt von unten */
export function HelpButton({ help }: { help: HelpText }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        aria-label={`Was bedeutet ${help.title}?`}
        onClick={() => setOpen(true)}
        className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-chip align-middle text-[13px] font-extrabold text-ink-2"
      >
        ?
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={help.title}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85dvh] w-full max-w-xl flex-col gap-3.5 overflow-y-auto rounded-t-[28px] bg-card px-5 pt-3 text-ink"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <span className="h-[5px] w-11 self-center rounded-full bg-dash" />
              <div className="flex items-center justify-between gap-3">
                <h2 className="m-0 text-xl font-extrabold">{help.title}</h2>
                <button type="button" aria-label="Schließen" onClick={() => setOpen(false)} className="flex size-11 items-center justify-center rounded-full bg-chip">
                  <IconClose size={18} />
                </button>
              </div>
              <p className="m-0 text-[15px] leading-normal">{help.what}</p>
              <div className="rounded-[18px] bg-chip px-4 py-3">
                <div className="text-xs font-bold text-muted">So erkennst du es</div>
                <p className="m-0 pt-1 text-sm leading-normal text-ink-2">{help.how}</p>
              </div>
              {(help.low || help.high) && (
                <div className="grid grid-cols-2 gap-2">
                  {[help.low, help.high].map((x) =>
                    x ? (
                      <div key={x.label} className="rounded-[18px] bg-rose-badge px-3.5 py-3">
                        <div className="text-[13px] font-extrabold text-berry-dark">{x.label}</div>
                        <div className="pt-0.5 text-[13px] leading-snug text-ink-2">{x.examples}</div>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
              {help.note && <p className="m-0 text-[13px] leading-normal text-muted">{help.note}</p>}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
