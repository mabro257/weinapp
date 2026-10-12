import { useMemo } from 'react'
import { api } from '../lib/api'
import { badges, twins } from '../lib/social'
import { useAsync } from '../lib/util'
import { useApp } from '../App'
import { ErrorBox, FormHeader, Loading, Page } from '../components/ui'
import { IconMedal } from '../components/Icons'

export default function BadgesPage() {
  const { profile, grapes } = useApp()
  const res = useAsync(async () => {
    const [mine, tastings, recs, friendRatings, friends] = await Promise.all([api.myRatings(), api.tastings(), api.recommendations(), api.friendRatings(), api.friends()])
    return { mine, tastings, recs, friendRatings, friends }
  }, [])

  const list = useMemo(() => {
    if (!res.data) return []
    const { mine, tastings, recs, friendRatings, friends } = res.data
    const sent = recs.filter((r) => !r.incoming)
    // Volltreffer: ein Freund hat einen empfohlenen Wein mit 90 oder mehr bewertet
    const nameToId = new Map(friends.map((f) => [f.displayName, f.userId]))
    const hits = sent.filter((r) => friendRatings.some((fr) => fr.userId === nameToId.get(r.toName) && fr.wineId === r.wine.id && fr.score >= 90)).length
    const best = twins(mine, friendRatings, friends, grapes).reduce<number | null>((a, t) => (t.match !== null && (a === null || t.match > a) ? t.match : a), null)
    return badges({
      mine,
      grapes,
      hostedTastings: tastings.filter((t) => t.hostId === profile.id).length,
      joinedTastings: new Set(mine.flatMap((r) => (r.tastingId ? [r.tastingId] : []))).size,
      sentRecommendations: sent.length,
      hitRecommendations: hits,
      bestMatch: best,
    })
  }, [res.data, grapes, profile.id])

  if (res.loading && !res.data) return <Page nav={false}><Loading /></Page>
  const done = list.filter((b) => b.have >= b.need).length

  return (
    <Page nav={false}>
      <FormHeader title="Abzeichen" sub={`${done} von ${list.length} erreicht`} />
      {res.error && <ErrorBox message={res.error} />}
      <div className="grid grid-cols-3 gap-2.5 px-4 pt-4">
        {list.map((b) => {
          const ok = b.have >= b.need
          return (
            <div key={b.name} className="flex flex-col items-center gap-1.5 rounded-[22px] bg-card px-2 py-3.5" aria-label={`${b.name}: ${b.desc}, ${ok ? 'erreicht' : `${b.have} von ${b.need}`}`}>
              <span className={`flex size-[52px] items-center justify-center rounded-full ${ok ? 'bg-berry text-white' : 'bg-chip'}`} style={ok ? undefined : { color: '#B9AFC0' }}>
                <IconMedal size={26} />
              </span>
              <span className="text-center text-xs leading-tight font-extrabold">{b.name}</span>
              <span className="text-center text-[11px] leading-snug text-muted">{b.desc}</span>
              {!ok && (
                <>
                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <span className="block h-1.5 rounded-full bg-berry" style={{ width: `${Math.round((b.have / b.need) * 100)}%` }} />
                  </span>
                  <span className="text-[11px] font-bold text-ink-2">{b.have} / {b.need}</span>
                </>
              )}
            </div>
          )
        })}
      </div>
      <div className="px-5 pt-4 text-xs leading-normal text-muted">Abzeichen sind nur Spaß. Sie werden aus deinen Bewertungen, Weinabenden und Empfehlungen berechnet.</div>
    </Page>
  )
}
