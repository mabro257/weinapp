import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Ask {
  title: string
  text?: string
  confirm: string
  /** rote Aktion (löschen, verlassen) */
  danger?: boolean
}

/**
 * Bestätigung im App-Stil statt des Browser-Dialogs.
 * Nutzung: const [ask, dialog] = useConfirm(); if (!(await ask({ ... }))) return; … und {dialog} rendern.
 */
export function useConfirm(): [(a: Ask) => Promise<boolean>, ReactNode] {
  const [cur, setCur] = useState<Ask | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const ask = useCallback((a: Ask) => {
    setCur(a)
    return new Promise<boolean>((res) => {
      resolver.current = res
    })
  }, [])
  const done = (v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setCur(null)
  }

  useEffect(() => {
    if (!cur) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && done(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cur])

  const dialog = cur
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => done(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={cur.title}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-xl flex-col gap-3 rounded-t-[28px] bg-card px-5 pt-5 text-ink"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
          >
            <h2 className="m-0 text-xl font-extrabold">{cur.title}</h2>
            {cur.text && <p className="m-0 text-[15px] leading-normal text-ink-2">{cur.text}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => done(false)} className="min-h-12 rounded-full bg-chip text-[15px] font-bold text-ink-2">
                Abbrechen
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => done(true)}
                className={`min-h-12 rounded-full text-[15px] font-bold text-white ${cur.danger ? 'bg-berry-dark' : 'bg-berry'}`}
              >
                {cur.confirm}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null
  return [ask, dialog]
}
