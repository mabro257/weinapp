import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { IconBack, IconGlass, IconPin, IconScale, IconSearch, IconSpark, IconUser, IconUsers } from './Icons'
import type { BoxSummary } from '../lib/stats'

/** Seitenrahmen: mobil volle Breite, auf großen Bildschirmen mittig begrenzt */
export function Page({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <main className="flex flex-1 flex-col pb-6">{children}</main>
      {nav && <BottomNav />}
    </div>
  )
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 pt-7">
      <h1 className="m-0 text-[28px] leading-tight font-extrabold">{title}</h1>
      {sub && <div className="text-[15px] font-medium text-ink-2">{sub}</div>}
    </div>
  )
}

/**
 * Zurück im Verlauf. Wurde die App direkt auf dieser Seite geöffnet (z. B. über einen Einladungslink),
 * gibt es keinen Verlauf: dann zur Ausweichseite.
 */
function useBack(fallback = '/') {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}

/** Kopfzeile für Formularseiten: runder Zurück-Button plus Titel */
export function FormHeader({ title, sub, closeIcon, fallback }: { title: string; sub?: string; closeIcon?: ReactNode; fallback?: string }) {
  const back = useBack(fallback)
  return (
    <div className="flex items-center gap-3 px-4 pt-5">
      <button
        type="button"
        aria-label="Zurück"
        onClick={back}
        className="flex size-11 flex-none items-center justify-center rounded-full bg-card"
      >
        {closeIcon ?? <IconBack />}
      </button>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="m-0 text-[22px] font-extrabold">{title}</h1>
        {sub && <div className="truncate text-[13px] font-medium text-muted">{sub}</div>}
      </div>
    </div>
  )
}

export function HeroBack({ to, fallback }: { to?: string; fallback?: string }) {
  const back = useBack(fallback)
  const cls = 'flex size-11 items-center justify-center rounded-full bg-white/15 text-white'
  if (to)
    return (
      <Link to={to} aria-label="Zurück" className={cls}>
        <IconBack />
      </Link>
    )
  return (
    <button type="button" aria-label="Zurück" onClick={back} className={cls}>
      <IconBack />
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[28px] bg-card p-5 ${className}`}>{children}</section>
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="m-0 text-lg font-bold">{children}</h2>
      {right}
    </div>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-chip px-2.5 py-1 text-xs font-semibold text-ink-2">{children}</span>
}

export function ScoreBadge({ score, size = 52 }: { score: number | null; size?: number }) {
  const empty = score === null
  return (
    <div
      className={`flex flex-none items-center justify-center rounded-[18px] font-extrabold ${
        empty ? 'bg-chip text-muted' : 'bg-rose-badge text-berry'
      }`}
      style={{ width: size, height: size, fontSize: size >= 52 ? 20 : 16 }}
    >
      {empty ? '–' : score}
    </div>
  )
}

const THUMB_STYLE: Record<string, { bg: string; fg: string }> = {
  rot: { bg: '#7A1F3D', fg: '#FFFFFF' },
  weiss: { bg: '#F3EAC2', fg: '#6B5A1E' },
  rose: { bg: '#F6D5DC', fg: '#8E2A4B' },
  schaum: { bg: '#E6E9F2', fg: '#4A4455' },
}

/** Vorschaubild für Listen: Etikettfoto, sonst ein Glas in der Farbe des Weintyps */
export function WineThumb({ labelUrl, type, size = 52, alt }: { labelUrl: string | null; type: string | null; size?: number; alt?: string }) {
  if (labelUrl) {
    return <img src={labelUrl} alt={alt ?? 'Etikett'} loading="lazy" className="flex-none rounded-[14px] bg-chip object-cover" style={{ width: size * 0.82, height: size }} />
  }
  const s = THUMB_STYLE[type ?? ''] ?? { bg: '#F4F2F7', fg: '#6B6475' }
  return (
    <div className="flex flex-none items-center justify-center rounded-[14px]" style={{ width: size * 0.82, height: size, background: s.bg, color: s.fg }} aria-hidden="true">
      <IconGlass size={Math.round(size * 0.48)} />
    </div>
  )
}

export function TagChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-chip px-2.5 py-1 text-xs font-semibold text-ink-2">
      <IconPin />
      {label}
    </span>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  allowClear,
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T | null) => void
  label: string
  allowClear?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="grid gap-1.5 rounded-full bg-chip p-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on && allowClear ? null : o.value)}
            className={`h-11 rounded-full text-sm ${on ? 'bg-berry font-bold text-white' : 'font-semibold text-ink-2'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Ein/Aus-Schalter */
export function Switch({ checked, onChange, labelledBy, label }: { checked: boolean; onChange: (v: boolean) => void; labelledBy?: string; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-8 w-14 flex-none rounded-full p-[3px] transition-colors ${checked ? 'justify-end bg-berry' : 'justify-start bg-dash'}`}
    >
      <span className="size-[26px] rounded-full bg-white shadow" />
    </button>
  )
}

/** Rundes Profilbild mit Anfangsbuchstaben, Farbe aus dem Namen abgeleitet */
const AVATAR_COLORS = [
  ['#F6E3E9', '#6C1E38'],
  ['#DDE8DA', '#2F4A2A'],
  ['#E6E9F2', '#2E3A5C'],
  ['#F3EAC2', '#6B5A1E'],
  ['#E9DFF3', '#4B2E6B'],
]
export function Avatar({ name, size = 44, me }: { name: string; size?: number; me?: boolean }) {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  const [bg, fg] = me ? ['#7A1F3D', '#FFFFFF'] : AVATAR_COLORS[idx]
  return (
    <span className="flex flex-none items-center justify-center rounded-full font-extrabold" style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.38 }} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

export function ScoreRing({ value, size = 112 }: { value: number | null; size?: number }) {
  const r = 48
  const c = 2 * Math.PI * r
  const v = value ?? 0
  return (
    <svg width={size} height={size} viewBox="0 0 112 112" role="img" aria-label={value === null ? 'Noch keine eigene Bewertung' : `Meine Bewertung: ${value} von 100 Punkten`} className="flex-none">
      <circle cx="56" cy="56" r={r} fill="none" stroke="#F1DCE3" strokeWidth="12" />
      {value !== null && (
        <circle cx="56" cy="56" r={r} fill="none" stroke="#8E2A4B" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 56 56)" />
      )}
      <text x="56" y="64" textAnchor="middle" fontSize="30" fontWeight="800" fill="#1E1B24">
        {value === null ? '–' : value}
      </text>
    </svg>
  )
}

/** Balken 1–5: eigener Wert als Füllung, Community als Punkt */
export function TasteBar({ label, word, mine, community }: { label: string; word: string; mine: number | null; community: number | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm font-semibold">
        <span>{label}</span>
        <span className="font-medium text-muted">{word}</span>
      </div>
      <div className="relative flex h-4 items-center">
        <div className="h-2.5 w-full rounded-full bg-rose" />
        {mine !== null && <div className="absolute left-0 h-2.5 rounded-full bg-berry" style={{ width: `${(mine / 5) * 100}%` }} />}
        {community !== null && (
          <div className="absolute size-4 rounded-full border-[3px] border-ink bg-white" style={{ left: `calc(${(community / 5) * 100}% - 8px)` }} />
        )}
      </div>
    </div>
  )
}

const AXIS_MIN = 70
const AXIS_MAX = 100
const pct = (v: number) => `${((Math.min(AXIS_MAX, Math.max(AXIS_MIN, v)) - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100}%`

/** Boxplot auf der Achse 70–100 (Werte darunter werden am Rand angezeigt) */
export function Boxplot({ s, height = 28 }: { s: BoxSummary; height?: number }) {
  const mid = height / 2
  return (
    <span className="relative block flex-1" style={{ height }}>
      <span className="absolute inset-y-0 w-px bg-line" style={{ left: '33.333%' }} />
      <span className="absolute inset-y-0 w-px bg-line" style={{ left: '66.667%' }} />
      {s.kind === 'dots' &&
        s.values.map((v, i) => (
          <span key={i} className="absolute size-2.5 rounded-full bg-berry/80" style={{ top: mid - 5, left: `calc(${pct(v)} - 5px)` }} />
        ))}
      {s.kind === 'box' && (
        <>
          <span className="absolute h-0.5 bg-ink-2" style={{ top: mid - 1, left: pct(s.whiskerLow), width: `calc(${pct(s.whiskerHigh)} - ${pct(s.whiskerLow)})` }} />
          <span className="absolute w-0.5 bg-ink-2" style={{ top: mid - 7, height: 14, left: pct(s.whiskerLow) }} />
          <span className="absolute w-0.5 bg-ink-2" style={{ top: mid - 7, height: 14, left: `calc(${pct(s.whiskerHigh)} - 2px)` }} />
          <span
            className="absolute rounded-[7px] border-2 border-berry bg-rose"
            style={{ top: mid - (height - 6) / 2, height: height - 6, left: pct(s.q1), width: `max(4px, calc(${pct(s.q3)} - ${pct(s.q1)}))` }}
          />
          <span className="absolute w-[3px] bg-berry" style={{ top: mid - (height - 6) / 2, height: height - 6, left: `calc(${pct(s.median)} - 1px)` }} />
          {s.outliers.map((o, i) => (
            <span key={i} className="absolute size-2.5 rounded-full border-2 border-berry bg-white" style={{ top: mid - 5, left: `calc(${pct(o)} - 5px)` }} />
          ))}
        </>
      )}
    </span>
  )
}

export function AxisLabels() {
  return (
    <span className="relative block h-4 flex-1 text-[11px] font-semibold text-muted">
      <span className="absolute left-0">70</span>
      <span className="absolute -translate-x-1/2" style={{ left: '33.333%' }}>80</span>
      <span className="absolute -translate-x-1/2" style={{ left: '66.667%' }}>90</span>
      <span className="absolute right-0">100</span>
    </span>
  )
}

export function PrimaryButton({ children, onClick, disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-berry text-base font-bold text-white hover:bg-berry-dark disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-12 w-full min-w-0 rounded-full border-0 bg-chip px-[18px] text-base outline-none ${props.className ?? ''}`} />
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-bold text-ink-2">
        {label}
      </label>
      {children}
    </div>
  )
}

export function Loading() {
  return <div className="px-4 py-10 text-center text-sm font-semibold text-muted">Lädt …</div>
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="mx-4 mt-4 rounded-[20px] bg-rose-badge px-4 py-3 text-sm font-semibold text-berry-dark">
      {message}
    </div>
  )
}

function NavItem({ to, label, icon, end }: { to: string; label: string; icon: ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-[52px] flex-col items-center justify-center gap-1 text-[11px] no-underline ${isActive ? 'font-extrabold text-berry' : 'font-semibold text-muted'}`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

export function BottomNav() {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="sticky bottom-0 grid grid-cols-5 gap-0.5 border-t border-line bg-card px-1 pt-2"
      style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
    >
      <NavItem to="/" end label="Suche" icon={<IconSearch />} />
      <NavItem to="/decider" label="Auswahl" icon={<IconScale />} />
      <NavItem to="/freunde" label="Freunde" icon={<IconUsers />} />
      <NavItem to="/geschmack" label="Geschmack" icon={<IconSpark />} />
      <NavItem to="/ich" label="Ich" icon={<IconUser />} />
    </nav>
  )
}
