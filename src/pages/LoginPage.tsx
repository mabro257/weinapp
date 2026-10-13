import { useState } from 'react'
import { api } from '../lib/api'
import { Field, PrimaryButton, TextInput } from '../components/ui'

/** Anmeldung per E-Mail-Code (kein Link, damit es in der installierten App funktioniert) */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <div className="flex flex-col gap-3 rounded-b-[36px] bg-hero px-5 pt-16 pb-14 text-white">
        <div className="text-sm font-semibold opacity-90">WineWithFriends</div>
        <h1 className="m-0 text-[30px] leading-tight font-extrabold">Willkommen</h1>
        <div className="text-[15px] opacity-90">Melde dich mit deiner E-Mail-Adresse an. Du bekommst einen Code, kein Passwort nötig.</div>
      </div>

      <form
        className="-mt-8 mx-4 flex flex-col gap-4 rounded-[28px] bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (step === 'email') run(async () => {
            await api.sendCode(email.trim())
            setStep('code')
          })
          else run(() => api.verifyCode(email.trim(), code.trim()))
        }}
      >
        {step === 'email' ? (
          <>
            <Field label="E-Mail-Adresse" htmlFor="email">
              <TextInput id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.de" />
            </Field>
            <div className="rounded-2xl bg-chip px-4 py-3 text-[13px] leading-snug text-ink-2">
              <b>Tipp:</b> Die E-Mail mit dem Code landet oft im <b>Spam-Ordner</b>. Schau dort nach, wenn sie nicht gleich kommt.
            </div>
          </>
        ) : (
          <>
            <div className="text-sm leading-relaxed text-ink-2">
              Wir haben einen Code an <strong>{email}</strong> geschickt.
            </div>
            <div className="rounded-2xl bg-rose-badge px-4 py-3 text-[13px] leading-snug font-semibold text-berry-dark">
              Keine E-Mail da? Bitte im Spam-Ordner nachsehen, dort landet der Code häufig.
            </div>
            <Field label="Code aus der E-Mail" htmlFor="code">
              <TextInput
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="text-center text-xl font-bold tracking-[0.3em]"
              />
            </Field>
          </>
        )}

        {error && (
          <div role="alert" className="rounded-2xl bg-rose-badge px-4 py-3 text-sm font-semibold text-berry-dark">
            {error}
          </div>
        )}

        <PrimaryButton type="submit" disabled={busy}>
          {busy ? 'Bitte warten …' : step === 'email' ? 'Code anfordern' : 'Anmelden'}
        </PrimaryButton>

        {step === 'code' && (
          <button type="button" className="min-h-11 text-sm font-bold text-berry" onClick={() => { setStep('email'); setCode('') }}>
            Andere E-Mail-Adresse verwenden
          </button>
        )}
        {api.mode === 'demo' && <div className="text-center text-xs text-muted">Demo-Modus: beliebige E-Mail und beliebiger Code.</div>}
      </form>
    </div>
  )
}
