import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { twins } from '../lib/social'
import { formatDate } from '../lib/text'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { Avatar, Card, CardTitle, ErrorBox, Loading, Page, PageTitle, PrimaryButton, TextInput, WineThumb } from '../components/ui'
import { IconBookmark, IconNext, IconScale } from '../components/Icons'

export default function FriendsPage() {
  const { grapes, profile } = useApp()
  const navigate = useNavigate()
  const res = useAsync(async () => {
    const [groups, tastings, recs, friends, friendRatings, mine] = await Promise.all([
      api.myGroups(),
      api.tastings(),
      api.recommendations(),
      api.friends(),
      api.friendRatings(),
      api.myRatings(),
    ])
    return { groups, tastings, recs, friends, friendRatings, mine }
  }, [])
  const [form, setForm] = useState<'none' | 'create' | 'join'>('none')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Set<number>>(new Set())

  const data = res.data
  const incoming = (data?.recs ?? []).filter((r) => r.incoming)
  const unseen = incoming.filter((r) => !r.seen).length
  // Empfehlungen als gelesen markieren, sobald die Seite sie gezeigt hat
  useEffect(() => {
    if (unseen > 0) api.markRecommendationsSeen().catch(() => undefined)
  }, [unseen])

  const twinList = useMemo(() => (data ? twins(data.mine, data.friendRatings, data.friends, grapes) : []), [data, grapes])
  const openTastings = (data?.tastings ?? []).filter((t) => t.status === 'offen')

  const submit = async () => {
    if (!value.trim()) return
    setBusy(true)
    setError(null)
    try {
      if (form === 'create') {
        const g = await api.createGroup(value)
        navigate(`/gruppe/${g.id}`)
      } else {
        const id = await api.joinGroup(value)
        navigate(`/gruppe/${id}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (res.loading && !data) return <Page><Loading /></Page>

  return (
    <Page>
      <PageTitle title="Freunde" sub="Gemeinsam probieren, empfehlen, entdecken" />
      {res.error && <ErrorBox message={res.error} />}

      <div className="flex flex-col gap-4 px-4 pt-5">
        {openTastings.map((t) => (
          <Link key={t.id} to={`/weinabend/${t.id}`} className="flex flex-col gap-2.5 rounded-[28px] bg-hero p-5 text-white no-underline">
            <span className="self-start rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">Läuft gerade</span>
            <span className="text-xl font-extrabold">{t.title}</span>
            <span className="text-sm opacity-90">{t.groupName} · {formatDate(t.eventDate)} · Gastgeber {t.hostId === profile.id ? 'du' : t.hostName}</span>
            <span className="flex items-center gap-2 text-sm font-bold">Zum Weinabend <IconNext size={18} /></span>
          </Link>
        ))}

        <Card className="pb-1">
          <CardTitle
            right={
              <span className="flex gap-2">
                <button type="button" onClick={() => { setForm(form === 'join' ? 'none' : 'join'); setValue(''); setError(null) }} className="h-9 rounded-full bg-chip px-3.5 text-[13px] font-bold text-ink-2">
                  Beitreten
                </button>
                <button type="button" onClick={() => { setForm(form === 'create' ? 'none' : 'create'); setValue(''); setError(null) }} className="h-9 rounded-full bg-rose-badge px-3.5 text-[13px] font-bold text-berry">
                  + Neu
                </button>
              </span>
            }
          >
            Meine Gruppen
          </CardTitle>
          {form !== 'none' && (
            <form
              className="flex flex-col gap-2.5 pt-3"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <label htmlFor="gruppe-eingabe" className="text-[13px] font-bold text-ink-2">
                {form === 'create' ? 'Name der neuen Gruppe' : 'Einladungscode (steht am Ende des Einladungslinks)'}
              </label>
              <TextInput id="gruppe-eingabe" value={value} onChange={(e) => setValue(e.target.value)} placeholder={form === 'create' ? 'z. B. Weinrunde Düsseldorf' : 'z. B. K7Q2PX9M'} autoComplete="off" />
              {error && <div role="alert" className="text-sm font-semibold text-berry-dark">{error}</div>}
              <PrimaryButton type="submit" disabled={busy || !value.trim()}>{form === 'create' ? 'Gruppe anlegen' : 'Beitreten'}</PrimaryButton>
            </form>
          )}
          <div className="pt-3">
            {data?.groups.length === 0 && (
              <div className="border-t border-line py-4 text-sm leading-normal text-muted">
                Noch keine Gruppe. Lege eine an und teile den Einladungslink mit deinen Freunden, oder tritt mit einem Code bei.
              </div>
            )}
            {data?.groups.map((g) => (
              <Link key={g.id} to={`/gruppe/${g.id}`} className="flex items-center gap-3 border-t border-line py-3.5 text-ink no-underline">
                <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-hero text-lg font-extrabold text-white">
                  {g.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{g.name}</span>
                  <span className="text-[13px] text-muted">{g.memberCount} {g.memberCount === 1 ? 'Mitglied' : 'Mitglieder'}{g.isAdmin ? ' · Admin' : ''}</span>
                </span>
                <IconNext size={18} className="flex-none text-muted" />
              </Link>
            ))}
          </div>
        </Card>

        {incoming.length > 0 && (
          <Card className="pb-1">
            <CardTitle right={unseen > 0 ? <span className="rounded-full bg-berry px-2.5 py-0.5 text-xs font-extrabold text-white">{unseen} neu</span> : undefined}>Für dich empfohlen</CardTitle>
            <div className="pt-3">
              {incoming.slice(0, 5).map((r) => (
                <div key={r.id} className="flex gap-3 border-t border-line py-3.5">
                  <Avatar name={r.fromName} size={40} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[13px] text-muted"><b className="text-ink">{r.fromName}</b> empfiehlt dir · {formatDate(r.createdAt.slice(0, 10))}</span>
                    <Link to={`/wein/${r.wine.id}`} className="flex items-center gap-3 text-ink no-underline">
                      <WineThumb labelUrl={r.wine.labelUrl} type={r.wine.type} size={44} />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[15px] font-bold">{r.wine.name}</span>
                        <span className="truncate text-[13px] text-muted">{[r.wine.winery, r.wine.mainGrape].filter(Boolean).join(' · ')}</span>
                      </span>
                    </Link>
                    {r.message && <span className="rounded-[14px] bg-chip px-3 py-2 text-[13px] leading-snug text-ink-2">„{r.message}"</span>}
                    <button
                      type="button"
                      disabled={saved.has(r.wine.id)}
                      onClick={async () => {
                        await api.setSaved(r.wine.id, true)
                        setSaved((s) => new Set(s).add(r.wine.id))
                      }}
                      className="flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-berry disabled:text-muted"
                    >
                      <IconBookmark size={18} filled={saved.has(r.wine.id)} />
                      {saved.has(r.wine.id) ? 'Gemerkt' : 'Auf die Merkliste'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {twinList.length > 0 && (
          <Link to="/zwillinge" className="flex flex-col gap-3 rounded-[28px] bg-card p-5 text-ink no-underline">
            <span className="flex items-center justify-between">
              <span className="text-lg font-bold">Geschmackszwillinge</span>
              <IconNext size={18} className="text-muted" />
            </span>
            {twinList.slice(0, 2).map((t) => (
              <span key={t.friend.userId} className="flex items-center gap-3">
                <Avatar name={t.friend.displayName} size={40} />
                <span className="flex-1 text-[15px] font-bold">{t.friend.displayName}</span>
                <span className="text-xl font-extrabold text-berry">{t.match === null ? '–' : `${t.match} %`}</span>
              </span>
            ))}
          </Link>
        )}

        <Link to="/decider?tisch=1" className="flex items-center gap-3.5 rounded-[28px] bg-card p-5 text-ink no-underline">
          <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-rose-badge text-berry"><IconScale size={24} /></span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-base font-extrabold">Gemeinsam entscheiden</span>
            <span className="text-[13px] text-muted">Welcher Wein schmeckt allen? Im Restaurant, im Laden oder für den nächsten Abend</span>
          </span>
          <IconNext size={18} className="flex-none text-muted" />
        </Link>

        {(data?.groups.length ?? 0) > 0 && (
          <Link to="/weinabend/neu" className="flex h-14 items-center justify-center rounded-full bg-berry text-base font-bold text-white no-underline hover:bg-berry-dark">
            Weinabend starten
          </Link>
        )}

        {(data?.tastings ?? []).filter((t) => t.status === 'aufgeloest').length > 0 && (
          <Card className="pb-1">
            <CardTitle>Vergangene Weinabende</CardTitle>
            <div className="pt-3">
              {data!.tastings.filter((t) => t.status === 'aufgeloest').slice(0, 5).map((t) => (
                <Link key={t.id} to={`/weinabend/${t.id}`} className="flex items-center justify-between gap-3 border-t border-line py-3.5 text-ink no-underline">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{t.title}</span>
                    <span className="text-[13px] text-muted">{t.groupName} · {formatDate(t.eventDate)}</span>
                  </span>
                  <IconNext size={18} className="flex-none text-muted" />
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Page>
  )
}
