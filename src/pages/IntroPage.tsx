import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useApp } from '../App'
import { IconBack, IconGlass, IconNext, IconScale, IconSearch, IconSpark, IconUser, IconUsers } from '../components/Icons'

/** In dieser Sitzung beendet: verhindert, dass die Einführung erneut öffnet, bevor das Profil neu geladen ist */
export const introDone = { current: false }

type Tab = 'suche' | 'decider' | 'freunde' | 'geschmack' | 'ich'

/** Verkleinerte Navigationsleiste: zeigt, wo die Funktion in der App zu finden ist */
function MiniNav({ active }: { active: Tab }) {
  const items: [Tab, string, ReactNode][] = [
    ['suche', 'Suche', <IconSearch size={18} />],
    ['decider', 'Auswahl', <IconScale size={18} />],
    ['freunde', 'Freunde', <IconUsers size={18} />],
    ['geschmack', 'Geschmack', <IconSpark size={18} />],
    ['ich', 'Ich', <IconUser size={18} />],
  ]
  return (
    <div className="grid grid-cols-5 gap-0.5 rounded-[18px] bg-card px-1 py-2 shadow-sm" aria-hidden="true">
      {items.map(([k, label, icon]) => (
        <span key={k} className={`flex flex-col items-center gap-0.5 rounded-xl py-1 text-[10px] ${k === active ? 'bg-rose-badge font-extrabold text-berry' : 'font-semibold text-muted'}`}>
          {icon}
          {label}
        </span>
      ))}
    </div>
  )
}

interface Slide {
  icon: ReactNode
  title: string
  body: ReactNode
  tab?: Tab
}

const B = ({ children }: { children: ReactNode }) => <b className="font-extrabold text-ink">{children}</b>
const Points = ({ items }: { items: ReactNode[] }) => (
  <ul className="m-0 flex list-none flex-col gap-2 p-0">
    {items.map((x, i) => (
      <li key={i} className="flex items-start gap-2.5">
        <span className="mt-2 size-1.5 flex-none rounded-full bg-berry" />
        <span>{x}</span>
      </li>
    ))}
  </ul>
)

const SLIDES: Slide[] = [
  {
    icon: <IconGlass size={44} />,
    title: 'Willkommen bei WineWithFriends',
    body: (
      <>
        <p className="m-0">Dein Weintagebuch für dich und deine Freunde. Halte fest, welche Weine dir schmecken, und finde heraus, was du als Nächstes trinken solltest.</p>
        <p className="m-0 text-muted">Die Einführung dauert eine Minute.</p>
      </>
    ),
  },
  {
    icon: <IconSearch size={40} />,
    title: 'Wein finden',
    tab: 'suche',
    body: (
      <>
        <p className="m-0">
          Tippe unter <B>Suche</B> den Namen des Weins ein, das Weingut (den Hersteller) oder die Rebsorte (die Traubensorte, z. B. Riesling).
        </p>
        <Points items={['Über 100.000 Weine sind schon im Katalog.', 'Nicht dabei? Dann legst du ihn mit einem Tipp selbst an.']} />
      </>
    ),
  },
  {
    icon: <span className="text-[34px] font-extrabold">88</span>,
    title: 'Wein bewerten',
    tab: 'suche',
    body: (
      <>
        <p className="m-0">
          Auf der Seite eines Weins tippst du auf <B>Neue Bewertung</B> und gibst eine Note von 1 bis 100. Sie zeigt nur, wie gut der Wein <B>dir</B> gefällt.
        </p>
        <div className="flex flex-wrap gap-1.5 text-[13px] font-bold">
          <span className="rounded-full bg-chip px-2.5 py-1 text-ink-2">unter 80: eher nicht</span>
          <span className="rounded-full bg-rose-badge px-2.5 py-1 text-berry-dark">85: sehr gut</span>
          <span className="rounded-full bg-berry px-2.5 py-1 text-white">ab 90: hervorragend</span>
        </div>
        <p className="m-0">
          Alles andere ist freiwillig, zum Beispiel Jahrgang (das Erntejahr), Notiz oder ein Foto vom Etikett. Ein <B>?</B> neben einem Begriff erklärt ihn.
        </p>
      </>
    ),
  },
  {
    icon: <IconSpark size={40} />,
    title: 'Dein Geschmack',
    tab: 'geschmack',
    body: (
      <>
        <p className="m-0">
          Aus deinen Bewertungen lernt die App, was dir schmeckt. Unter <B>Geschmack</B> siehst du:
        </p>
        <Points items={['deine Top 5 und deine Lieblingsrebsorten', 'wie viel Genuss du fürs Geld bekommst', 'Vorschläge, was du probieren könntest']} />
        <p className="m-0 text-muted">Je mehr du bewertest, desto genauer wird es.</p>
      </>
    ),
  },
  {
    icon: <IconScale size={40} />,
    title: 'Hilfe bei der Wahl',
    tab: 'decider',
    body: (
      <p className="m-0">
        Unsicher zwischen mehreren Weinen, etwa im Restaurant oder im Supermarkt? Füge sie unter <B>Auswahl</B> hinzu. Dort siehst du, welcher am besten zu deinem Geschmack passt, und warum.
      </p>
    ),
  },
  {
    icon: <IconUsers size={40} />,
    title: 'Mit Freunden',
    tab: 'freunde',
    body: (
      <>
        <p className="m-0">
          Unter <B>Freunde</B> legst du eine Gruppe an, also eine private Runde, und lädst andere per Link ein.
        </p>
        <Points
          items={[
            'Die Gruppe sieht deine Bewertungen. Einzelne kannst du auf privat stellen.',
            <>
              <B>Weinabend:</B> Ihr probiert gemeinsam, jeder bewertet auf dem eigenen Handy. Die Noten bleiben verdeckt, bis der Gastgeber (wer den Abend anlegt) sie aufdeckt.
            </>,
            <>
              <B>Empfehlen:</B> Schick Freunden einen Wein, den sie probieren sollten.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    icon: <IconUser size={40} />,
    title: 'Alles an einem Ort',
    tab: 'ich',
    body: (
      <>
        <p className="m-0">
          Unter <B>Ich</B> findest du alle deine Bewertungen, deine Merkliste (Weine, die du dir für später merkst) und deine Abzeichen (kleine Auszeichnungen fürs Bewerten und Teilen).
        </p>
        <p className="m-0 text-muted">Diese Einführung kannst du dort jederzeit wieder ansehen.</p>
      </>
    ),
  },
]

/** Einführung für neue Nutzer, unter „Ich" erneut abspielbar */
export default function IntroPage() {
  const navigate = useNavigate()
  const { profile, refreshProfile } = useApp()
  // Danach zurück, woher die Einführung aufgerufen wurde (z. B. „Ich" oder die Gruppe nach einer Einladung), sonst zur Suche
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [i, setI] = useState(0)
  const touch = useRef<number | null>(null)
  const last = i === SLIDES.length - 1
  const s = SLIDES[i]

  const finish = async () => {
    introDone.current = true
    if (!profile.introSeen) {
      try {
        await api.markIntroSeen()
      } catch {
        // nicht kritisch: dann erscheint die Einführung beim nächsten Start noch einmal
      }
      refreshProfile()
    }
    navigate(from, { replace: true })
  }
  const go = (d: number) => setI((cur) => Math.max(0, Math.min(SLIDES.length - 1, cur + d)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-page"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return
        const dx = e.changedTouches[0].clientX - touch.current
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        touch.current = null
      }}
    >
      <div className="flex items-center justify-between px-4 pt-[max(16px,env(safe-area-inset-top))]">
        <span className="text-sm font-bold text-muted">
          {i + 1} von {SLIDES.length}
        </span>
        {!last && (
          <button type="button" onClick={finish} className="min-h-11 px-2 text-sm font-bold text-berry">
            Überspringen
          </button>
        )}
      </div>

      <main className="flex flex-1 flex-col justify-center gap-6 px-6 py-6" aria-live="polite">
        <span className="flex size-[88px] items-center justify-center self-center rounded-[28px] bg-hero text-white">{s.icon}</span>
        <h1 className="m-0 text-center text-[26px] leading-tight font-extrabold">{s.title}</h1>
        <div className="flex flex-col gap-3.5 text-[15px] leading-normal text-ink-2">{s.body}</div>
        {s.tab && (
          <div className="flex flex-col gap-1.5">
            <span className="text-center text-xs font-semibold text-muted">Zu finden in der Leiste unten:</span>
            <MiniNav active={s.tab} />
          </div>
        )}
      </main>

      <div className="sticky bottom-0 flex flex-col gap-4 bg-page px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {SLIDES.map((_, n) => (
            <span key={n} className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-berry' : 'w-2 bg-dash'}`} />
          ))}
        </div>
        <div className="flex gap-3">
          {i > 0 && (
            <button type="button" aria-label="Zurück" onClick={() => go(-1)} className="flex size-14 flex-none items-center justify-center rounded-full bg-card text-ink">
              <IconBack />
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? finish() : go(1))}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-berry text-base font-bold text-white hover:bg-berry-dark"
          >
            {last ? "Los geht's" : 'Weiter'}
            {!last && <IconNext size={20} />}
          </button>
        </div>
      </div>
    </div>
  )
}
