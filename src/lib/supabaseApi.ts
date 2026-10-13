import { createClient } from '@supabase/supabase-js'
import type { Api } from './api'
import type {
  CommunityStats,
  Friend,
  FriendRating,
  Grape,
  Group,
  Member,
  RatingWithWine,
  Recommendation,
  SavedWine,
  Tasting,
  Wine,
  WineHit,
  WineType,
} from './types'

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  })

  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message)
  }

  const userId = async () => {
    const { data } = await sb.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('Nicht angemeldet')
    return id
  }

  const labelUrl = (path: string | null) =>
    path ? sb.storage.from('labels').getPublicUrl(path).data.publicUrl : null

  const toHit = (r: Record<string, unknown>): WineHit => ({
    id: Number(r.id),
    name: String(r.name),
    winery: (r.winery as string) ?? null,
    region: (r.region as string) ?? null,
    mainGrape: (r.main_grape as string) ?? null,
    myAvg: num(r.my_avg),
    type: (r.type as WineType) ?? null,
    labelUrl: labelUrl((r.label_path as string) ?? null),
    best: r.best === true,
  })

  const RATING_COLS =
    'id, wine_id, score, vintage, tasted_on, body, acidity, tannin, note, tags, shared, tasting_id, wines(name, winery, region, country, type, body, acidity, wine_grapes(grape_id, position))'
  const WINE_COLS = 'id, name, winery, region, type, label_path, wine_grapes(position, grapes(name))'

  const toRating = (r: Record<string, any>): RatingWithWine => {
    const wine = r.wines ?? {}
    const grapes = ((wine.wine_grapes ?? []) as { grape_id: number; position: number }[]).sort((a, b) => a.position - b.position)
    return {
      id: Number(r.id),
      wineId: Number(r.wine_id),
      score: r.score,
      vintage: num(r.vintage),
      tastedOn: r.tasted_on,
      body: num(r.body),
      acidity: num(r.acidity),
      tannin: num(r.tannin),
      note: r.note,
      tags: r.tags ?? [],
      shared: r.shared !== false,
      tastingId: num(r.tasting_id),
      wineName: wine.name ?? 'Unbekannter Wein',
      winery: wine.winery ?? null,
      region: wine.region ?? null,
      country: wine.country ?? null,
      mainGrapeId: grapes.length ? Number(grapes[0].grape_id) : null,
      wineBody: num(wine.body),
      wineAcidity: num(wine.acidity),
      wineType: (wine.type as WineType) ?? null,
    }
  }

  const wineToHit = (w: Record<string, any>): WineHit => {
    const grapes = ((w.wine_grapes ?? []) as { position: number; grapes: { name: string } | null }[]).sort((a, b) => a.position - b.position)
    return {
      id: Number(w.id),
      name: w.name,
      winery: w.winery ?? null,
      region: w.region ?? null,
      mainGrape: grapes[0]?.grapes?.name ?? null,
      myAvg: null,
      type: (w.type as WineType) ?? null,
      labelUrl: labelUrl(w.label_path ?? null),
      best: false,
    }
  }

  const toTasting = (t: Record<string, any>): Tasting => ({
    id: Number(t.id),
    groupId: Number(t.group_id),
    groupName: t.groups?.name ?? '',
    title: t.title,
    eventDate: t.event_date,
    hostId: t.host,
    hostName: t.host_profile?.display_name ?? '',
    status: t.status,
  })

  const getWine = async (id: number): Promise<Wine | null> => {
    const { data, error } = await sb
      .from('wines')
      .select('id, name, winery, country, region, type, price_class, body, acidity, label_path, merged_into, created_by, status, wine_grapes(grape_id, position)')
      .eq('id', id)
      .maybeSingle()
    fail(error)
    if (!data) return null
    const { data: s } = await sb.auth.getSession()
    const uid = s.session?.user.id
    const { data: me } = uid ? await sb.from('profiles').select('is_admin').eq('id', uid).maybeSingle() : { data: null }
    // Zusammengeführte Dublette: auf den Zielwein umleiten
    if (data.merged_into) return getWine(Number(data.merged_into))
    const grapes = ((data.wine_grapes ?? []) as { grape_id: number; position: number }[])
      .sort((a, b) => a.position - b.position)
      .map((g) => Number(g.grape_id))
    return {
      id: Number(data.id),
      name: data.name,
      winery: data.winery,
      country: data.country,
      region: data.region,
      type: data.type as WineType | null,
      priceClass: num(data.price_class),
      grapeIds: grapes,
      body: num(data.body),
      acidity: num(data.acidity),
      labelUrl: labelUrl(data.label_path),
      editable: me?.is_admin === true || (data.created_by === uid && data.status === 'offen'),
    }
  }

  const saveGrapes = async (wineId: number, grapeIds: number[]) => {
    if (!grapeIds.length) return
    const { error } = await sb.from('wine_grapes').insert(grapeIds.map((g, i) => ({ wine_id: wineId, grape_id: g, position: i + 1 })))
    fail(error)
  }

  return {
    mode: 'supabase',

    async getProfile() {
      const { data: s } = await sb.auth.getSession()
      if (!s.session) return null
      const { data, error } = await sb
        .from('profiles')
        .select('id, display_name, is_admin')
        .eq('id', s.session.user.id)
        .maybeSingle()
      fail(error)
      if (!data) return { id: s.session.user.id, displayName: s.session.user.email ?? 'Ich', isAdmin: false }
      return { id: data.id, displayName: data.display_name, isAdmin: data.is_admin }
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb())
      return () => data.subscription.unsubscribe()
    },
    async sendCode(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
      fail(error)
    },
    async verifyCode(email, code) {
      const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' })
      fail(error)
    },
    async signOut() {
      const { error } = await sb.auth.signOut()
      fail(error)
    },
    async updateDisplayName(name) {
      const id = await userId()
      const { error } = await sb.from('profiles').update({ display_name: name }).eq('id', id)
      fail(error)
    },

    async searchWines(query) {
      if (!query.trim()) return []
      const { data, error } = await sb.rpc('search_wines', { q: query, lim: 20 })
      fail(error)
      return (data ?? []).map(toHit)
    },
    async findSimilarWines(name, winery) {
      if (name.trim().length < 3) return []
      const { data, error } = await sb.rpc('similar_wines', { p_name: name, p_winery: winery })
      fail(error)
      return (data ?? []).map(toHit)
    },
    getWine,
    async createWine(input) {
      const { data, error } = await sb
        .from('wines')
        .insert({
          name: input.name.trim(),
          winery: input.winery?.trim() || null,
          country: input.country?.trim() || null,
          region: input.region?.trim() || null,
          type: input.type,
          price_class: input.priceClass,
          source: 'manuell',
        })
        .select('id')
        .single()
      fail(error)
      const wineId = Number(data!.id)
      await saveGrapes(wineId, input.grapeIds)
      return wineId
    },
    async updateWine(id, input) {
      const { data, error } = await sb
        .from('wines')
        .update({
          name: input.name.trim(),
          winery: input.winery?.trim() || null,
          country: input.country?.trim() || null,
          region: input.region?.trim() || null,
          type: input.type,
          price_class: input.priceClass,
        })
        .eq('id', id)
        .select('id')
      fail(error)
      if (!data?.length) throw new Error('Du darfst diesen Wein nicht ändern.')
      const { error: e2 } = await sb.from('wine_grapes').delete().eq('wine_id', id)
      fail(e2)
      await saveGrapes(id, input.grapeIds)
    },
    async duplicateCandidates() {
      const { data, error } = await sb.rpc('duplicate_candidates')
      fail(error)
      return ((data ?? []) as Record<string, any>[]).map((r) => ({
        a: { id: Number(r.a_id), name: r.a_name, winery: r.a_winery, source: r.a_source, ratings: Number(r.a_ratings) },
        b: { id: Number(r.b_id), name: r.b_name, winery: r.b_winery, source: r.b_source, ratings: Number(r.b_ratings) },
        score: Number(r.score),
      }))
    },
    async mergeWines(from, into) {
      const { error } = await sb.rpc('merge_wines', { p_from: from, p_into: into })
      fail(error)
    },
    async dismissDuplicate(a, b) {
      const { error } = await sb.rpc('dismiss_duplicate', { p_a: a, p_b: b })
      fail(error)
    },
    async uploadLabel(wineId, file) {
      const path = `${wineId}/${crypto.randomUUID()}.webp`
      const { error } = await sb.storage.from('labels').upload(path, file, { contentType: file.type || 'image/webp' })
      fail(error)
      const { error: e2 } = await sb.rpc('set_wine_label', { p_wine: wineId, p_path: path })
      fail(e2)
    },
    async wineCommunity(wineId) {
      const { data, error } = await sb.rpc('wine_community', { p_wine: wineId })
      fail(error)
      const rows = (data ?? []) as Record<string, unknown>[]
      return rows
        .filter((r) => r.is_total || r.vintage !== null)
        .map(
          (r): CommunityStats => ({
            vintage: r.is_total ? null : num(r.vintage),
            avg: Number(r.avg_score),
            count: Number(r.n),
            raters: Number(r.raters),
            body: num(r.avg_body),
            acidity: num(r.avg_acidity),
            tannin: num(r.avg_tannin),
          }),
        )
    },

    async listGrapes() {
      const { data, error } = await sb
        .from('grapes')
        .select('id, name, synonyms, color, short, aromas, regions, body, acidity, tannin, food')
        .order('name')
      fail(error)
      return (data ?? []).map(
        (g): Grape => ({
          id: Number(g.id),
          name: g.name,
          synonyms: g.synonyms ?? [],
          color: g.color,
          short: g.short,
          aromas: g.aromas ?? [],
          regions: g.regions,
          body: num(g.body),
          acidity: num(g.acidity),
          tannin: num(g.tannin),
          food: g.food,
        }),
      )
    },
    async grapeCommunity() {
      const { data, error } = await sb.rpc('grape_community')
      fail(error)
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        grapeId: Number(r.grape_id),
        avg: Number(r.avg_score),
        count: Number(r.n),
      }))
    },

    async savedWines() {
      const { data, error } = await sb
        .from('saved_wines')
        .select('created_at, wines(id, name, winery, region, type, label_path, wine_grapes(position, grapes(name)))')
        .order('created_at', { ascending: false })
      fail(error)
      return ((data ?? []) as Record<string, any>[])
        .filter((r) => r.wines)
        .map((r): SavedWine => {
          const w = r.wines
          const grapes = ((w.wine_grapes ?? []) as { position: number; grapes: { name: string } | null }[]).sort(
            (a, b) => a.position - b.position,
          )
          return {
            id: Number(w.id),
            name: w.name,
            winery: w.winery,
            region: w.region,
            mainGrape: grapes[0]?.grapes?.name ?? null,
            myAvg: null,
            type: w.type,
            labelUrl: labelUrl(w.label_path),
            best: false,
            savedAt: r.created_at,
          }
        })
    },
    async isSaved(wineId) {
      const { count, error } = await sb.from('saved_wines').select('wine_id', { count: 'exact', head: true }).eq('wine_id', wineId)
      fail(error)
      return (count ?? 0) > 0
    },
    async setSaved(wineId, saved) {
      if (saved) {
        const { error } = await sb.from('saved_wines').upsert({ wine_id: wineId }, { onConflict: 'user_id,wine_id', ignoreDuplicates: true })
        fail(error)
      } else {
        const { error } = await sb.from('saved_wines').delete().eq('wine_id', wineId)
        fail(error)
      }
    },

    async myRatings() {
      const id = await userId()
      const { data, error } = await sb
        .from('ratings')
        .select(RATING_COLS)
        .eq('user_id', id)
        .order('tasted_on', { ascending: false })
        .order('id', { ascending: false })
      fail(error)
      return ((data ?? []) as Record<string, any>[]).map(toRating)
    },
    async myTags() {
      const id = await userId()
      const { data, error } = await sb.from('ratings').select('tags').eq('user_id', id).limit(500)
      fail(error)
      const counts = new Map<string, number>()
      for (const r of data ?? []) for (const t of (r.tags ?? []) as string[]) counts.set(t, (counts.get(t) ?? 0) + 1)
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
    },
    async createRating(input) {
      const { error } = await sb.from('ratings').insert({
        wine_id: input.wineId,
        score: input.score,
        vintage: input.vintage,
        tasted_on: input.tastedOn,
        body: input.body,
        acidity: input.acidity,
        tannin: input.tannin,
        note: input.note,
        tags: input.tags,
        shared: input.shared,
        tasting_id: input.tastingId,
      })
      fail(error)
    },
    async deleteRating(id) {
      const { error } = await sb.from('ratings').delete().eq('id', id)
      fail(error)
    },
    async setRatingShared(id, shared) {
      const { error } = await sb.from('ratings').update({ shared }).eq('id', id)
      fail(error)
    },

    // ---------------- Gruppen ----------------
    async myGroups() {
      const id = await userId()
      const { data, error } = await sb
        .from('group_members')
        .select('role, groups(id, name, invite_code, group_members(count))')
        .eq('user_id', id)
      fail(error)
      return ((data ?? []) as Record<string, any>[])
        .filter((r) => r.groups)
        .map(
          (r): Group => ({
            id: Number(r.groups.id),
            name: r.groups.name,
            inviteCode: r.groups.invite_code,
            isAdmin: r.role === 'admin',
            memberCount: Number(r.groups.group_members?.[0]?.count ?? 1),
          }),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    },
    async groupMembers(groupId) {
      const { data, error } = await sb.from('group_members').select('user_id, role, profiles(display_name)').eq('group_id', groupId)
      fail(error)
      return ((data ?? []) as Record<string, any>[])
        .map((r): Member => ({ userId: r.user_id, displayName: r.profiles?.display_name ?? 'Unbekannt', role: r.role }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))
    },
    async createGroup(name) {
      const { data, error } = await sb.rpc('create_group', { p_name: name })
      fail(error)
      const row = ((data ?? []) as Record<string, any>[])[0]
      return { id: Number(row.id), name: name.trim(), inviteCode: row.invite_code, isAdmin: true, memberCount: 1 }
    },
    async joinGroup(code) {
      const { data, error } = await sb.rpc('join_group', { p_code: code })
      fail(error)
      return Number(data)
    },
    async leaveGroup(groupId) {
      const id = await userId()
      const { error } = await sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', id)
      fail(error)
    },
    async friends() {
      const id = await userId()
      const { data, error } = await sb.from('group_members').select('user_id, profiles(display_name)').neq('user_id', id)
      fail(error)
      const seen = new Map<string, Friend>()
      for (const r of (data ?? []) as Record<string, any>[]) {
        if (!seen.has(r.user_id)) seen.set(r.user_id, { userId: r.user_id, displayName: r.profiles?.display_name ?? 'Unbekannt' })
      }
      return [...seen.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))
    },
    async friendRatings() {
      const id = await userId()
      const { data, error } = await sb.from('ratings').select(`user_id, ${RATING_COLS}`).neq('user_id', id).limit(5000)
      fail(error)
      return ((data ?? []) as Record<string, any>[]).map((r): FriendRating => ({ ...toRating(r), userId: r.user_id }))
    },

    // ---------------- Empfehlungen ----------------
    async recommendations() {
      const id = await userId()
      const { data, error } = await sb
        .from('recommendations')
        .select(`id, from_user, to_user, message, seen, created_at, wine:wines(${WINE_COLS}), sender:profiles!recommendations_from_user_fkey(display_name), receiver:profiles!recommendations_to_user_fkey(display_name)`)
        .order('created_at', { ascending: false })
        .limit(100)
      fail(error)
      return ((data ?? []) as Record<string, any>[])
        .filter((r) => r.wine)
        .map(
          (r): Recommendation => ({
            id: Number(r.id),
            fromName: r.sender?.display_name ?? 'Unbekannt',
            toName: r.receiver?.display_name ?? 'Unbekannt',
            incoming: r.to_user === id,
            wine: wineToHit(r.wine),
            message: r.message,
            seen: r.seen,
            createdAt: r.created_at,
          }),
        )
    },
    async recommend(wineId, toUserIds, message) {
      if (!toUserIds.length) return
      const { error } = await sb
        .from('recommendations')
        .insert(toUserIds.map((u) => ({ to_user: u, wine_id: wineId, message: message?.trim() || null })))
      fail(error)
    },
    async markRecommendationsSeen() {
      const id = await userId()
      const { error } = await sb.from('recommendations').update({ seen: true }).eq('to_user', id).eq('seen', false)
      fail(error)
    },

    // ---------------- Weinabende ----------------
    async tastings() {
      const { data, error } = await sb
        .from('tastings')
        .select('id, group_id, title, event_date, host, status, groups(name), host_profile:profiles!tastings_host_fkey(display_name)')
        .order('event_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(30)
      fail(error)
      return ((data ?? []) as Record<string, any>[]).map(toTasting)
    },
    async tasting(id) {
      const { data, error } = await sb
        .from('tastings')
        .select(`id, group_id, title, event_date, host, status, groups(name), host_profile:profiles!tastings_host_fkey(display_name), tasting_wines(position, wines(${WINE_COLS}))`)
        .eq('id', id)
        .maybeSingle()
      fail(error)
      if (!data) return null
      const { data: prog, error: e2 } = await sb.rpc('tasting_progress', { p_tasting: id })
      fail(e2)
      const wines = (((data as Record<string, any>).tasting_wines ?? []) as Record<string, any>[])
        .filter((tw) => tw.wines)
        .sort((a, b) => a.position - b.position)
        .map((tw) => wineToHit(tw.wines))
      return {
        tasting: toTasting(data as Record<string, any>),
        wines,
        progress: ((prog ?? []) as Record<string, any>[]).map((p) => ({ userId: p.user_id, displayName: p.display_name, rated: Number(p.rated) })),
      }
    },
    async createTasting(groupId, title, eventDate) {
      const { data, error } = await sb
        .from('tastings')
        .insert({ group_id: groupId, title: title.trim(), event_date: eventDate })
        .select('id')
        .single()
      fail(error)
      return Number(data!.id)
    },
    async addTastingWine(tastingId, wineId) {
      const { count } = await sb.from('tasting_wines').select('wine_id', { count: 'exact', head: true }).eq('tasting_id', tastingId)
      const { error } = await sb
        .from('tasting_wines')
        .upsert({ tasting_id: tastingId, wine_id: wineId, position: (count ?? 0) + 1 }, { onConflict: 'tasting_id,wine_id', ignoreDuplicates: true })
      fail(error)
    },
    async removeTastingWine(tastingId, wineId) {
      const { error } = await sb.from('tasting_wines').delete().eq('tasting_id', tastingId).eq('wine_id', wineId)
      fail(error)
    },
    async revealTasting(tastingId) {
      const { error } = await sb.from('tastings').update({ status: 'aufgeloest' }).eq('id', tastingId)
      fail(error)
    },
    async deleteTasting(tastingId, deleteRatings) {
      const { data, error } = await sb.rpc('delete_tasting', { p_tasting: tastingId, p_delete_ratings: deleteRatings })
      fail(error)
      return Number(data ?? 0)
    },
    async tastingRatings(tastingId) {
      const { data, error } = await sb.from('ratings').select(`user_id, ${RATING_COLS}`).eq('tasting_id', tastingId)
      fail(error)
      return ((data ?? []) as Record<string, any>[]).map((r): FriendRating => ({ ...toRating(r), userId: r.user_id }))
    },
  }
}
