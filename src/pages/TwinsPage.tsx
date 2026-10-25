import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { MIN_COMMON, twins } from '../lib/social'
import { preference } from '../lib/taste'
import { TASTE, type TasteKey } from '../lib/text'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { Avatar, Card, ErrorBox, FormHeader, Loading, Page } from '../components/ui'

const fmt = (v: number | null) => (v === null ? '–' : v.toFixed(1).replace('.', ','))

export default function TwinsPage() {
  const { grapes } = useApp()
  const res = useAsync(async () => {
    const [mine, friendRatings, friends] = await Promise.all([api.myRatings(), api.friendRatings(), api.friends()])
    return { mine, friendRatings, friends }
  }, [])
  const list = useMemo(() => (res.data ? twins(res.data.mine, res.data.friendRatings, res.data.friends, grapes) : []), [res.data, grapes])
  const [pick, setPick] = useState<string | null>(null)
  const myPref = useMemo(() => (res.data ? preference(res.data.mine, grapes) : null), [res.data, grapes])

  if (res.loading && !res.data) return <Page nav={false}><Loading /></Page>
  const current = list.find((t) => t.friend.userId === pick) ?? list[0]

  return (
    <Page nav={false}>
      <FormHeader title="Geschmackszwillinge" sub="Wer trinkt so wie du?" />
      {res.error && <ErrorBox message={res.error} />}
      <div className="flex flex-col gap-4 px-4 pt-4">
        {!current && (
          <Card>
            <div className="text-sm leading-normal text-ink-2">Noch keine Freunde mit geteilten Bewertungen. Tritt einer Gruppe bei oder lade Freunde ein.</div>
          </Card>
        )}

        {current && (
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <svg width="96" height="96" viewBox="0 0 112 112" role="img" aria-label={current.match === null ? 'Noch keine Übereinstimmung berechenbar' : `Übereinstimmung ${current.match} Prozent`} className="flex-none">
                <circle cx="56" cy="56" r="48" fill="none" stroke="#F1DCE3" strokeWidth="12" />
                {current.match !== null && (
                  <circle cx="56" cy="56" r="48" fill="none" stroke="#8E2A4B" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(current.match / 100) * 301.6} 301.6`} transform="rotate(-90 56 56)" />
                )}
                <text x="56" y="64" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1E1B24">{current.match === null ? '–' : `${current.match} %`}</text>
              </svg>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[13px] font-bold text-muted">{current === list[0] && current.match !== null ? 'Dein Zwilling' : 'Vergleich mit'}</span>
                <span className="text-[22px] font-extrabold">{current.friend.displayName}</span>
                <span className="text-[13px] leading-snug text-ink-2">
                  {current.common} gemeinsam bewertete {current.common === 1 ? 'Wein' : 'Weine'}
                  {current.meanDiff !== null ? `, im Schnitt ${Math.round(current.meanDiff)} Punkte auseinander` : ''}
                  {current.common < MIN_COMMON ? `. Ab ${MIN_COMMON} gemeinsamen Weinen gibt es einen Prozentwert.` : ''}
                </span>
              </div>
            </div>
            {myPref && (
              <div className="flex flex-col gap-2.5">
                <div className="text-[13px] font-bold text-muted">Geschmacksprofil im Vergleich</div>
                {(['body', 'acidity', 'tannin'] as TasteKey[]).map((k) => {
                  const me = myPref[k]
                  const ot = current.profile[k]
                  if (me === null && ot === null) return null
                  return (
                    <div key={k} className="flex flex-col gap-1">
                      <div className="flex justify-between text-[13px] font-semibold">
                        <span>{TASTE[k].label}</span>
                        <span className="text-muted">du {fmt(me)} · {current.friend.displayName} {fmt(ot)}</span>
                      </div>
                      <div className="relative flex h-4 items-center">
                        <div className="h-2.5 w-full rounded-full bg-rose" />
                        {me !== null && <div className="absolute left-0 h-2.5 rounded-full bg-berry" style={{ width: `${(me / 5) * 100}%` }} />}
                        {ot !== null && <div className="absolute size-4 rounded-full border-[3px] bg-white" style={{ left: `calc(${(ot / 5) * 100}% - 8px)`, borderColor: '#2F4A2A' }} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {current && current.tips.length > 0 && (
          <Card className="pb-1">
            <h2 className="m-0 text-lg font-bold">{current.friend.displayName} liebt, du kennst sie noch nicht</h2>
            <div className="pb-3 text-[13px] text-muted">Die beste Quelle für deinen nächsten Wein</div>
            {current.tips.map((t) => (
              <Link key={t.wineId} to={`/wein/${t.wineId}`} className="flex items-center gap-3 border-t border-line py-3 text-ink no-underline">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{t.name}</span>
                  <span className="truncate text-[13px] text-muted">{t.winery}</span>
                </span>
                <span className="flex flex-none flex-col items-end">
                  <span className="text-lg font-extrabold" style={{ color: '#2F4A2A' }}>{t.score}</span>
                  <span className="text-[11px] font-semibold text-muted">{current.friend.displayName}</span>
                </span>
              </Link>
            ))}
          </Card>
        )}

        {current?.disagree && (
          <Card className="flex flex-col gap-2.5">
            <h2 className="m-0 text-lg font-bold">Hier seid ihr uneins</h2>
            <Link to={`/wein/${current.disagree.wineId}`} className="flex items-center justify-between gap-3 text-ink no-underline">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{current.disagree.name}</span>
                <span className="text-[13px] text-muted">{current.disagree.winery}</span>
              </span>
              <span className="text-sm font-bold whitespace-nowrap">du {current.disagree.mine} · {current.friend.displayName} {current.disagree.theirs}</span>
            </Link>
          </Card>
        )}

        {list.length > 1 && (
          <Card className="pb-1">
            <h2 className="m-0 mb-3 text-lg font-bold">Alle Freunde</h2>
            {list.map((t) => (
              <button
                key={t.friend.userId}
                type="button"
                aria-pressed={t === current}
                onClick={() => setPick(t.friend.userId)}
                className={`flex w-full items-center gap-3 border-t border-line py-3 text-left ${t === current ? 'bg-chip' : ''}`}
              >
                <Avatar name={t.friend.displayName} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{t.friend.displayName}</span>
                  <span className="text-[13px] text-muted">{t.common} gemeinsame Weine{t.common < MIN_COMMON ? ', noch zu wenige' : ''}</span>
                </span>
                <span className="text-lg font-extrabold text-berry">{t.match === null ? '–' : `${t.match} %`}</span>
              </button>
            ))}
          </Card>
        )}

        <div className="px-1 text-xs leading-normal text-muted">
          Je ähnlicher ihr dieselben Weine bewertet, desto höher der Wert. Ab {MIN_COMMON} gemeinsam bewerteten Weinen.
        </div>
      </div>
    </Page>
  )
}
