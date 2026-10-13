import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { twins } from '../lib/social'
import { mean } from '../lib/stats'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { Avatar, Card, ErrorBox, HeroBack, Loading, Page } from '../components/ui'

export default function GroupPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { profile, grapes } = useApp()
  const [copied, setCopied] = useState(false)
  const res = useAsync(async () => {
    const [groups, members, friendRatings, mine, friends] = await Promise.all([
      api.myGroups(),
      api.groupMembers(id),
      api.friendRatings(),
      api.myRatings(),
      api.friends(),
    ])
    return { group: groups.find((g) => g.id === id) ?? null, members, friendRatings, mine, friends }
  }, [id])

  const view = useMemo(() => {
    if (!res.data) return null
    const memberIds = new Set(res.data.members.map((m) => m.userId))
    const twinList = twins(res.data.mine, res.data.friendRatings.filter((r) => memberIds.has(r.userId)), res.data.friends.filter((f) => memberIds.has(f.userId)), grapes)
    const matchOf = new Map(twinList.map((t) => [t.friend.userId, t.match]))
    // Lieblinge der Runde: Weine mit mindestens 2 Bewertungen aus der Gruppe
    const all = [...res.data.mine.map((r) => ({ ...r, userId: profile.id })), ...res.data.friendRatings.filter((r) => memberIds.has(r.userId))]
    const byWine = new Map<number, { name: string; winery: string | null; scores: number[]; users: Set<string> }>()
    for (const r of all) {
      const cur = byWine.get(r.wineId) ?? { name: r.wineName, winery: r.winery, scores: [], users: new Set<string>() }
      cur.scores.push(r.score)
      cur.users.add(r.userId)
      byWine.set(r.wineId, cur)
    }
    const top = [...byWine.entries()]
      .filter(([, v]) => v.users.size >= 2)
      .map(([wineId, v]) => ({ wineId, name: v.name, winery: v.winery, avg: Math.round(mean(v.scores)!), people: v.users.size }))
      .sort((a, b) => b.avg - a.avg || b.people - a.people)
      .slice(0, 5)
    const counts = new Map<string, number>()
    for (const r of all) counts.set(r.userId, (counts.get(r.userId) ?? 0) + 1)
    return { matchOf, top, counts }
  }, [res.data, grapes, profile.id])

  if (res.loading && !res.data) return <Page><Loading /></Page>
  if (res.error) return <Page><ErrorBox message={res.error} /></Page>
  const group = res.data?.group
  if (!group || !view) return <Page><ErrorBox message="Gruppe nicht gefunden oder du bist kein Mitglied." /></Page>

  const link = `${window.location.origin}/beitreten/${group.inviteCode}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Link kopieren:', link)
    }
  }
  const share = async () => {
    const text = `Komm in unsere Weinrunde „${group.name}": ${link}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Einladung zu WineWithFriends', text, url: link })
      } catch {
        // abgebrochen
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }
  const leave = async () => {
    if (!confirm(`Gruppe „${group.name}" wirklich verlassen? Die Mitglieder sehen deine Bewertungen danach nicht mehr.`)) return
    await api.leaveGroup(group.id)
    navigate('/freunde', { replace: true })
  }

  return (
    <Page>
      <div className="flex flex-col gap-3 rounded-b-[36px] bg-hero px-5 pt-5 pb-16 text-white">
        <div className="mb-2"><HeroBack fallback="/freunde" /></div>
        <h1 className="m-0 text-[28px] leading-[1.1] font-extrabold">{group.name}</h1>
        <div className="text-[15px] opacity-90">{res.data!.members.length} Mitglieder{group.isAdmin ? ' · du bist Admin' : ''}</div>
      </div>

      <div className="relative -mt-10 flex flex-col gap-4 px-4">
        <Card className="flex flex-col gap-3">
          <h2 className="m-0 text-lg font-bold">Freunde einladen</h2>
          <div className="text-sm leading-normal text-ink-2">Wer den Link öffnet und sich anmeldet, ist automatisch in der Gruppe.</div>
          <div className="flex items-center gap-2 rounded-full bg-chip py-1.5 pr-1.5 pl-4">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-2">{link.replace(/^https?:\/\//, '')}</span>
            <button type="button" onClick={copy} className="h-10 flex-none rounded-full bg-berry px-4 text-[13px] font-bold text-white">{copied ? 'Kopiert' : 'Kopieren'}</button>
          </div>
          <button type="button" onClick={share} className="h-12 rounded-full border-2 border-line bg-card text-[15px] font-bold">Per WhatsApp oder Mail teilen</button>
          <div className="text-xs text-muted">Code: {group.inviteCode}</div>
        </Card>

        <Card className="pb-1">
          <h2 className="m-0 mb-3 text-lg font-bold">Mitglieder</h2>
          {res.data!.members.map((m) => {
            const me = m.userId === profile.id
            const match = view.matchOf.get(m.userId)
            const n = view.counts.get(m.userId) ?? 0
            return (
              <div key={m.userId} className="flex items-center gap-3 border-t border-line py-3">
                <Avatar name={m.displayName} me={me} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{me ? `${m.displayName} (du)` : m.displayName}</span>
                  <span className="text-[13px] text-muted">{m.role === 'admin' ? 'Admin · ' : ''}{n} {n === 1 ? 'Bewertung' : 'Bewertungen'}{me ? '' : ' sichtbar'}</span>
                </span>
                {!me && <span className="text-sm font-extrabold text-berry">{match === null || match === undefined ? '–' : `${match} %`}</span>}
              </div>
            )
          })}
        </Card>

        {view.top.length > 0 && (
          <Card className="pb-1">
            <h2 className="m-0 mb-3 text-lg font-bold">Lieblinge der Runde</h2>
            {view.top.map((t, i) => (
              <Link key={t.wineId} to={`/wein/${t.wineId}`} className="flex items-center gap-3 border-t border-line py-3 text-ink no-underline">
                <span className="w-7 flex-none text-lg font-extrabold text-muted">{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{t.name}</span>
                  <span className="truncate text-[13px] text-muted">{[t.winery, `${t.people} aus der Runde`].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-rose-badge text-lg font-extrabold text-berry">{t.avg}</span>
              </Link>
            ))}
          </Card>
        )}

        <Link to={`/weinabend/neu?gruppe=${group.id}`} className="flex h-14 items-center justify-center rounded-full bg-berry text-base font-bold text-white no-underline hover:bg-berry-dark">
          Weinabend mit dieser Gruppe starten
        </Link>
        <button type="button" onClick={leave} className="h-12 text-sm font-bold text-muted">Gruppe verlassen</button>
      </div>
    </Page>
  )
}
