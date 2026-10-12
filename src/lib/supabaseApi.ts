import { createClient } from '@supabase/supabase-js'
import type { Api } from './api'
import type { CommunityStats, Grape, RatingWithWine, SavedWine, Wine, WineHit, WineType } from './types'

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

  const getWine = async (id: number): Promise<Wine | null> => {
    const { data, error } = await sb
      .from('wines')
      .select('id, name, winery, country, region, type, price_class, body, acidity, label_path, merged_into, wine_grapes(grape_id, position)')
      .eq('id', id)
      .maybeSingle()
    fail(error)
    if (!data) return null
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
    }
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
      if (input.grapeIds.length) {
        const { error: e2 } = await sb
          .from('wine_grapes')
          .insert(input.grapeIds.map((g, i) => ({ wine_id: wineId, grape_id: g, position: i + 1 })))
        fail(e2)
      }
      return wineId
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
        .select('id, wine_id, score, vintage, tasted_on, body, acidity, tannin, note, tags, wines(name, winery, region, country, wine_grapes(grape_id, position))')
        .eq('user_id', id)
        .order('tasted_on', { ascending: false })
        .order('id', { ascending: false })
      fail(error)
      return ((data ?? []) as Record<string, any>[]).map((r): RatingWithWine => {
        const wine = r.wines ?? {}
        const grapes = ((wine.wine_grapes ?? []) as { grape_id: number; position: number }[]).sort(
          (a, b) => a.position - b.position,
        )
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
          wineName: wine.name ?? 'Unbekannter Wein',
          winery: wine.winery ?? null,
          region: wine.region ?? null,
          country: wine.country ?? null,
          mainGrapeId: grapes.length ? Number(grapes[0].grape_id) : null,
        }
      })
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
      })
      fail(error)
    },
    async deleteRating(id) {
      const { error } = await sb.from('ratings').delete().eq('id', id)
      fail(error)
    },
  }
}
