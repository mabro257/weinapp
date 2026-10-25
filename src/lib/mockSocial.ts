import type { Api } from './api'
import type { FriendRating, Group, RatingWithWine, Recommendation, Tasting, TastingWine, Wine, WineHit } from './types'
import { DEMO_FRIENDS, DEMO_ME, type DemoRating } from './demoData'

/** Soziale Daten im Demo-Modus */
export interface SocialStore {
  groups: { id: number; name: string; code: string; members: { userId: string; role: 'admin' | 'member' }[] }[]
  recs: { id: number; from: string; to: string; wineId: number; message: string | null; seen: boolean; at: string }[]
  tastings: {
    id: number; groupId: number; title: string; date: string; host: string; status: 'offen' | 'aufgeloest'; wineIds: number[]
    /** Teilnehmer; fehlt = ganze Gruppe */
    participants?: string[]
    /** sichtbar geschaltete Weine; fehlt = alle sichtbar (ältere Abende) */
    visibleIds?: number[]
  }[]
}

export function initialSocial(): SocialStore {
  return {
    groups: [
      {
        id: 1, name: 'Weinrunde Düsseldorf', code: 'K7Q2PX9M',
        members: [{ userId: DEMO_ME.id, role: 'admin' }, ...DEMO_FRIENDS.map((f) => ({ userId: f.id, role: 'member' as const }))],
      },
      { id: 2, name: 'Familie', code: 'FAM4L13X', members: [{ userId: DEMO_ME.id, role: 'admin' }, { userId: 'demo-f3', role: 'member' }] },
    ],
    recs: [
      { id: 1, from: 'demo-f2', to: DEMO_ME.id, wineId: 7, message: 'Musst du probieren, eleganter als der Barolo letzte Woche.', seen: false, at: '2026-10-11T19:00:00Z' },
      { id: 2, from: 'demo-f3', to: DEMO_ME.id, wineId: 19, message: null, seen: false, at: '2026-10-09T18:00:00Z' },
    ],
    tastings: [{ id: 1, groupId: 1, title: 'Weinabend bei mir', date: '2026-10-12', host: DEMO_ME.id, status: 'offen', wineIds: [24, 9, 7, 15] }],
  }
}

interface Ctx {
  get: () => { social: SocialStore; ratings: DemoRating[]; wines: Wine[] }
  save: () => void
  wait: <T>(v: T) => Promise<T>
  toHit: (w: Wine) => WineHit
  withWine: (r: DemoRating) => RatingWithWine
}

const nameOf = (id: string) => (id === DEMO_ME.id ? DEMO_ME.displayName : DEMO_FRIENDS.find((f) => f.id === id)?.name ?? 'Unbekannt')

type Social = Pick<
  Api,
  | 'myGroups' | 'groupMembers' | 'createGroup' | 'joinGroup' | 'leaveGroup' | 'renameGroup' | 'removeMember' | 'deleteGroup' | 'friends' | 'friendRatings'
  | 'recommendations' | 'recommend' | 'markRecommendationsSeen' | 'deleteRecommendation'
  | 'tastings' | 'tasting' | 'createTasting' | 'setTastingDate' | 'setTastingParticipants' | 'setTastingWineVisible' | 'addTastingWine' | 'removeTastingWine' | 'revealTasting' | 'deleteTasting' | 'tastingRatings'
>

export function createSocialMock(ctx: Ctx): Social {
  const s = () => ctx.get().social
  const myGroups = () => s().groups.filter((g) => g.members.some((m) => m.userId === DEMO_ME.id))
  const friendIds = () => new Set(myGroups().flatMap((g) => g.members.map((m) => m.userId)).filter((id) => id !== DEMO_ME.id))
  const tastingOpen = (id: number | null) => (id === null ? false : s().tastings.find((t) => t.id === id)?.status === 'offen')
  const toTasting = (t: SocialStore['tastings'][number]): Tasting => ({
    id: t.id, groupId: t.groupId, groupName: s().groups.find((g) => g.id === t.groupId)?.name ?? '', title: t.title,
    eventDate: t.date, hostId: t.host, hostName: nameOf(t.host), status: t.status,
  })
  const visibleFriendRating = (r: DemoRating) => r.userId !== DEMO_ME.id && r.shared && friendIds().has(r.userId) && !tastingOpen(r.tastingId)

  return {
    async myGroups() {
      return ctx.wait(
        myGroups().map((g): Group => ({ id: g.id, name: g.name, inviteCode: g.code, isAdmin: g.members.some((m) => m.userId === DEMO_ME.id && m.role === 'admin'), memberCount: g.members.length })),
      )
    },
    async groupMembers(groupId) {
      const g = myGroups().find((x) => x.id === groupId)
      return ctx.wait((g?.members ?? []).map((m) => ({ userId: m.userId, displayName: nameOf(m.userId), role: m.role })))
    },
    async createGroup(name) {
      const id = Math.max(0, ...s().groups.map((g) => g.id)) + 1
      const code = Math.random().toString(36).slice(2, 10).toUpperCase()
      s().groups.push({ id, name: name.trim(), code, members: [{ userId: DEMO_ME.id, role: 'admin' }] })
      ctx.save()
      return ctx.wait({ id, name: name.trim(), inviteCode: code, isAdmin: true, memberCount: 1 })
    },
    async joinGroup(code) {
      const g = s().groups.find((x) => x.code === code.trim().toUpperCase())
      if (!g) throw new Error('Einladungscode ungültig')
      if (!g.members.some((m) => m.userId === DEMO_ME.id)) g.members.push({ userId: DEMO_ME.id, role: 'member' })
      ctx.save()
      return ctx.wait(g.id)
    },
    async leaveGroup(groupId) {
      const g = s().groups.find((x) => x.id === groupId)
      if (g) g.members = g.members.filter((m) => m.userId !== DEMO_ME.id)
      ctx.save()
      await ctx.wait(null)
    },
    async renameGroup(groupId, name) {
      const g = s().groups.find((x) => x.id === groupId)
      if (g) g.name = name.trim()
      ctx.save()
      await ctx.wait(null)
    },
    async removeMember(groupId, userId) {
      const g = s().groups.find((x) => x.id === groupId)
      if (g) g.members = g.members.filter((m) => m.userId !== userId)
      ctx.save()
      await ctx.wait(null)
    },
    async deleteGroup(groupId) {
      s().groups = s().groups.filter((x) => x.id !== groupId)
      s().tastings = s().tastings.filter((t) => t.groupId !== groupId)
      ctx.save()
      await ctx.wait(null)
    },
    async friends() {
      return ctx.wait([...friendIds()].map((id) => ({ userId: id, displayName: nameOf(id) })).sort((a, b) => a.displayName.localeCompare(b.displayName, 'de')))
    },
    async friendRatings() {
      return ctx.wait(ctx.get().ratings.filter(visibleFriendRating).map((r): FriendRating => ({ ...ctx.withWine(r), userId: r.userId })))
    },

    async recommendations() {
      const wines = ctx.get().wines
      return ctx.wait(
        s()
          .recs.filter((r) => r.to === DEMO_ME.id || r.from === DEMO_ME.id)
          .sort((a, b) => (a.at < b.at ? 1 : -1))
          .flatMap((r): Recommendation[] => {
            const w = wines.find((x) => x.id === r.wineId)
            return w
              ? [{ id: r.id, fromName: nameOf(r.from), toName: nameOf(r.to), incoming: r.to === DEMO_ME.id, wine: ctx.toHit(w), message: r.message, seen: r.seen, createdAt: r.at }]
              : []
          }),
      )
    },
    async recommend(wineId, toUserIds, message) {
      let id = Math.max(0, ...s().recs.map((r) => r.id))
      for (const to of toUserIds) s().recs.push({ id: ++id, from: DEMO_ME.id, to, wineId, message: message?.trim() || null, seen: false, at: new Date().toISOString() })
      ctx.save()
      await ctx.wait(null)
    },
    async deleteRecommendation(id) {
      s().recs = s().recs.filter((r) => r.id !== id)
      ctx.save()
      await ctx.wait(null)
    },
    async markRecommendationsSeen() {
      for (const r of s().recs) if (r.to === DEMO_ME.id) r.seen = true
      ctx.save()
      await ctx.wait(null)
    },

    async tastings() {
      const ids = new Set(myGroups().map((g) => g.id))
      return ctx.wait(s().tastings.filter((t) => ids.has(t.groupId)).sort((a, b) => (a.date < b.date ? 1 : -1)).map(toTasting))
    },
    async tasting(id) {
      const t = s().tastings.find((x) => x.id === id)
      if (!t) return ctx.wait(null)
      const g = s().groups.find((x) => x.id === t.groupId)
      // Demo: du bist immer Gastgeber und siehst deshalb auch verdeckte Weine
      const wines = t.wineIds.flatMap((wid): TastingWine[] => {
        const w = ctx.get().wines.find((x) => x.id === wid)
        return w ? [{ ...ctx.toHit(w), visible: !t.visibleIds || t.visibleIds.includes(wid) || t.status !== 'offen' }] : []
      })
      const members = (g?.members ?? []).filter((m) => !t.participants || t.participants.includes(m.userId) || m.userId === t.host)
      const progress = members.map((m) => ({
        userId: m.userId,
        displayName: nameOf(m.userId),
        rated: new Set(ctx.get().ratings.filter((r) => r.tastingId === id && r.userId === m.userId).map((r) => r.wineId)).size,
      }))
      return ctx.wait({ tasting: toTasting(t), wines, progress })
    },
    async createTasting(groupId, title, eventDate, participantIds) {
      const id = Math.max(0, ...s().tastings.map((t) => t.id)) + 1
      s().tastings.push({
        id, groupId, title: title.trim(), date: eventDate, host: DEMO_ME.id, status: 'offen', wineIds: [],
        participants: [...new Set([DEMO_ME.id, ...participantIds])], visibleIds: [],
      })
      ctx.save()
      return ctx.wait(id)
    },
    async setTastingDate(tastingId, eventDate) {
      const t = s().tastings.find((x) => x.id === tastingId)
      if (t && t.host === DEMO_ME.id) t.date = eventDate
      ctx.save()
      await ctx.wait(null)
    },
    async setTastingParticipants(tastingId, userIds) {
      const t = s().tastings.find((x) => x.id === tastingId)
      if (t && t.host === DEMO_ME.id) t.participants = [...new Set([DEMO_ME.id, ...userIds])]
      ctx.save()
      await ctx.wait(null)
    },
    async setTastingWineVisible(tastingId, wineId, visible) {
      const t = s().tastings.find((x) => x.id === tastingId)
      if (t && t.host === DEMO_ME.id) {
        const cur = t.visibleIds ?? [...t.wineIds]
        t.visibleIds = visible ? [...new Set([...cur, wineId])] : cur.filter((w) => w !== wineId)
      }
      ctx.save()
      await ctx.wait(null)
    },
    async addTastingWine(tastingId, wineId) {
      const t = s().tastings.find((x) => x.id === tastingId)
      if (t && t.host === DEMO_ME.id && !t.wineIds.includes(wineId)) t.wineIds.push(wineId)
      ctx.save()
      await ctx.wait(null)
    },
    async removeTastingWine(tastingId, wineId) {
      const t = s().tastings.find((x) => x.id === tastingId)
      if (t && t.host === DEMO_ME.id) t.wineIds = t.wineIds.filter((w) => w !== wineId)
      ctx.save()
      await ctx.wait(null)
    },
    async revealTasting(tastingId) {
      const t = s().tastings.find((x) => x.id === tastingId)
      if (t && t.host === DEMO_ME.id) t.status = 'aufgeloest'
      ctx.save()
      await ctx.wait(null)
    },
    async deleteTasting(tastingId, deleteRatings) {
      const store = ctx.get()
      const t = store.social.tastings.find((x) => x.id === tastingId)
      if (!t || t.host !== DEMO_ME.id) throw new Error('Nur der Gastgeber kann den Weinabend löschen')
      const before = store.ratings.length
      store.ratings = deleteRatings
        ? store.ratings.filter((r) => r.tastingId !== tastingId)
        : store.ratings.map((r) => (r.tastingId === tastingId ? { ...r, tastingId: null } : r))
      store.social.tastings = store.social.tastings.filter((x) => x.id !== tastingId)
      ctx.save()
      return ctx.wait(before - store.ratings.length)
    },
    async tastingRatings(tastingId) {
      return ctx.wait(
        ctx
          .get()
          .ratings.filter((r) => r.tastingId === tastingId && (r.userId === DEMO_ME.id || visibleFriendRating(r)))
          .map((r): FriendRating => ({ ...ctx.withWine(r), userId: r.userId })),
      )
    },
  }
}
