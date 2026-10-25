import type { Api } from './api'
import type { CommunityStats, DuplicatePair, Grape, NewRating, NewWine, RatingWithWine, SavedWine, Wine, WineHit } from './types'
import { DUPLICATE_MIN, wineSimilarity } from './naming'
import { GRAPES } from './grapesData'
import { DEMO_ME, DEMO_WINES, buildDemoRatings, type DemoRating } from './demoData'
import { normalize, numWords, searchTokens } from './text'
import { createSocialMock, initialSocial, type SocialStore } from './mockSocial'

/**
 * Demo-Modus: alle Daten liegen im Browser (localStorage).
 * Eigene Änderungen bleiben auf diesem Gerät erhalten.
 */
const STORE_KEY = 'weinapp-demo-v2'

interface Store {
  wines: Wine[]
  ratings: DemoRating[]
  displayName: string
  signedIn: boolean
  saved?: { wineId: number; at: string }[]
  social: SocialStore
  /** zusammengeführte Weine: alte ID → neue ID */
  merged?: Record<number, number>
  /** als „kein Duplikat" markierte Paare „a-b" */
  dismissed?: string[]
  /** Einführung gesehen (fehlt = ja) */
  introSeen?: boolean
}

/** Doppelt angelegter Wein, damit die Dubletten-Prüfung im Demo-Modus etwas zeigt */
const DEMO_DUPLICATE: Wine = {
  id: 26, name: 'Kabinett Riesling', winery: 'Probestein', country: 'Deutschland', region: 'Mosel',
  type: 'weiss', priceClass: null, grapeIds: [20], body: null, acidity: null, labelUrl: null,
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    // Speicher nicht verfügbar: mit frischen Demo-Daten starten
  }
  return { wines: [...DEMO_WINES, DEMO_DUPLICATE], ratings: buildDemoRatings(), displayName: DEMO_ME.displayName, signedIn: true, social: initialSocial() }
}

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

export function createMockApi(): Api {
  let store = load()
  const listeners = new Set<() => void>()

  const save = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store))
    } catch {
      // ignorieren
    }
  }
  const wait = <T,>(v: T) => new Promise<T>((res) => setTimeout(() => res(v), 120))
  const grapeName = (id: number | undefined) => GRAPES.find((g) => g.id === id)?.name ?? null
  const mine = () => store.ratings.filter((r) => r.userId === DEMO_ME.id)
  const withWine = (r: DemoRating): RatingWithWine => {
    const wine = store.wines.find((x) => x.id === r.wineId)
    return {
      ...r,
      wineName: wine?.name ?? 'Unbekannter Wein',
      winery: wine?.winery ?? null,
      region: wine?.region ?? null,
      country: wine?.country ?? null,
      mainGrapeId: wine?.grapeIds[0] ?? null,
      wineBody: wine?.body ?? null,
      wineAcidity: wine?.acidity ?? null,
      wineType: wine?.type ?? null,
      winePriceClass: wine?.priceClass ?? null,
    }
  }

  const toHit = (wine: Wine, best = false): WineHit => {
    const own = mine().filter((r) => r.wineId === wine.id).map((r) => r.score)
    const a = avg(own)
    return {
      id: wine.id, name: wine.name, winery: wine.winery, region: wine.region,
      mainGrape: grapeName(wine.grapeIds[0]), myAvg: a === null ? null : Math.round(a),
      type: wine.type, labelUrl: wine.labelUrl, best,
    }
  }

  const haystack = (wine: Wine) =>
    numWords(normalize([wine.name, wine.winery, wine.region, wine.country,
      ...wine.grapeIds.flatMap((id) => {
        const g = GRAPES.find((x) => x.id === id)
        return g ? [g.name, ...g.synonyms] : []
      })].join(' ')))

  return {
    mode: 'demo',

    async getProfile() {
      // Demo: Einführung gilt als gesehen, solange der Merker fehlt (Beispielnutzer hat schon bewertet)
      return wait(store.signedIn ? { ...DEMO_ME, displayName: store.displayName, introSeen: store.introSeen ?? true } : null)
    },
    async markIntroSeen() {
      store.introSeen = true
      save()
      await wait(null)
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async sendCode() {
      await wait(null)
    },
    async verifyCode() {
      store.signedIn = true
      save()
      listeners.forEach((l) => l())
    },
    async signOut() {
      store.signedIn = false
      save()
      listeners.forEach((l) => l())
    },
    async updateDisplayName(name) {
      store.displayName = name
      save()
      listeners.forEach((l) => l())
    },

    async searchWines(query) {
      const tokens = searchTokens(query)
      if (!tokens.length) return []
      const hits = store.wines.filter((wine) => {
        const hay = haystack(wine)
        return tokens.every((t) => hay.includes(t))
      })
      // Beste Treffer: alle Suchwörter stehen im Weinnamen selbst
      const inName = (wine: Wine) => tokens.every((t) => numWords(normalize(wine.name)).includes(t))
      hits.sort((a, b) => Number(inName(b)) - Number(inName(a)))
      return wait(hits.slice(0, 20).map((w) => toHit(w, inName(w))))
    },
    async findSimilarWines(name, winery) {
      if (name.trim().length < 3) return []
      const hits = store.wines
        .map((w) => ({ w, s: wineSimilarity(name, winery, w.name, w.winery) }))
        .filter((x) => x.s >= 0.45)
        .sort((a, b) => b.s - a.s)
      return wait(hits.slice(0, 3).map((x) => toHit(x.w)))
    },
    async getWine(id) {
      const target = store.merged?.[id] ?? id
      const wine = store.wines.find((x) => x.id === target)
      return wait(wine ? { ...wine, editable: true } : null)
    },
    async createWine(input: NewWine) {
      const id = Math.max(0, ...store.wines.map((x) => x.id), ...Object.keys(store.merged ?? {}).map(Number)) + 1
      store.wines = [...store.wines, { ...input, id, body: null, acidity: null, labelUrl: null }]
      save()
      return wait(id)
    },
    async updateWine(id, input) {
      store.wines = store.wines.map((w) => (w.id === id ? { ...w, ...input } : w))
      save()
      await wait(null)
    },
    async setWinePrice(id, priceClass) {
      store.wines = store.wines.map((w) => (w.id === id ? { ...w, priceClass } : w))
      save()
      await wait(null)
    },
    async duplicateCandidates() {
      const rated = (id: number) => store.ratings.filter((r) => r.wineId === id).length
      const out: DuplicatePair[] = []
      const ws = store.wines
      for (let i = 0; i < ws.length; i++)
        for (let j = i + 1; j < ws.length; j++) {
          const [a, b] = [ws[i], ws[j]]
          if (a.type && b.type && a.type !== b.type) continue
          if ((store.dismissed ?? []).includes(`${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`)) continue
          const s = wineSimilarity(a.name, a.winery, b.name, b.winery)
          if (s < DUPLICATE_MIN) continue
          const side = (w: Wine) => ({ id: w.id, name: w.name, winery: w.winery, source: w.id > 25 ? 'manuell' : 'import', ratings: rated(w.id) })
          out.push({ a: side(b), b: side(a), score: s })
        }
      return wait(out)
    },
    async mergeWines(from, into) {
      const fromWine = store.wines.find((w) => w.id === from)
      store.ratings = store.ratings.map((r) => (r.wineId === from ? { ...r, wineId: into } : r))
      const saved = store.saved ?? []
      store.saved = saved.some((s) => s.wineId === into) ? saved.filter((s) => s.wineId !== from) : saved.map((s) => (s.wineId === from ? { ...s, wineId: into } : s))
      store.social.recs = store.social.recs.map((r) => (r.wineId === from ? { ...r, wineId: into } : r))
      store.social.tastings = store.social.tastings.map((t) => ({ ...t, wineIds: [...new Set(t.wineIds.map((w) => (w === from ? into : w)))] }))
      store.wines = store.wines
        .filter((w) => w.id !== from)
        .map((w) => (w.id === into && !w.labelUrl && fromWine?.labelUrl ? { ...w, labelUrl: fromWine.labelUrl } : w))
      store.merged = { ...(store.merged ?? {}), [from]: into }
      save()
      await wait(null)
    },
    async dismissDuplicate(a, b) {
      store.dismissed = [...(store.dismissed ?? []), `${Math.min(a, b)}-${Math.max(a, b)}`]
      save()
      await wait(null)
    },
    async uploadLabel(wineId, file) {
      // Im Demo-Modus als Data-URL speichern (nur auf diesem Gerät)
      const url = await new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result as string)
        fr.onerror = () => rej(fr.error)
        fr.readAsDataURL(file)
      })
      store.wines = store.wines.map((x) => (x.id === wineId && !x.labelUrl ? { ...x, labelUrl: url } : x))
      save()
    },
    async wineCommunity(wineId) {
      const rs = store.ratings.filter((r) => r.wineId === wineId)
      const group = (list: DemoRating[], vintage: number | null): CommunityStats => ({
        vintage,
        avg: avg(list.map((r) => r.score)) ?? 0,
        count: list.length,
        raters: new Set(list.map((r) => r.userId)).size,
        body: avg(list.flatMap((r) => (r.body ? [r.body] : []))),
        acidity: avg(list.flatMap((r) => (r.acidity ? [r.acidity] : []))),
        tannin: avg(list.flatMap((r) => (r.tannin ? [r.tannin] : []))),
      })
      if (!rs.length) return wait([])
      const vintages = [...new Set(rs.flatMap((r) => (r.vintage ? [r.vintage] : [])))]
      return wait([group(rs, null), ...vintages.map((v) => group(rs.filter((r) => r.vintage === v), v))])
    },

    async listGrapes(): Promise<Grape[]> {
      return wait(GRAPES)
    },
    async grapeCommunity() {
      const byGrape = new Map<number, number[]>()
      for (const r of store.ratings) {
        const g = store.wines.find((x) => x.id === r.wineId)?.grapeIds[0]
        if (g === undefined) continue
        byGrape.set(g, [...(byGrape.get(g) ?? []), r.score])
      }
      return wait([...byGrape.entries()].map(([grapeId, xs]) => ({ grapeId, avg: avg(xs) ?? 0, count: xs.length })))
    },

    async savedWines(): Promise<SavedWine[]> {
      const saved = store.saved ?? []
      return wait(
        saved.flatMap((s) => {
          const wine = store.wines.find((x) => x.id === s.wineId)
          return wine ? [{ ...toHit(wine), savedAt: s.at }] : []
        }),
      )
    },
    async isSaved(wineId) {
      return wait((store.saved ?? []).some((s) => s.wineId === wineId))
    },
    async setSaved(wineId, saved) {
      const rest = (store.saved ?? []).filter((s) => s.wineId !== wineId)
      store.saved = saved ? [{ wineId, at: new Date().toISOString() }, ...rest] : rest
      save()
      await wait(null)
    },

    async myRatings(): Promise<RatingWithWine[]> {
      const list = mine()
        .map(withWine)
        .sort((a, b) => (a.tastedOn < b.tastedOn ? 1 : a.tastedOn > b.tastedOn ? -1 : b.id - a.id))
      return wait(list)
    },
    async myTags() {
      const counts = new Map<string, number>()
      for (const r of mine()) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
      return wait([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t))
    },
    async createRating(input: NewRating) {
      const id = Math.max(0, ...store.ratings.map((r) => r.id)) + 1
      store.ratings = [...store.ratings, { ...input, id, userId: DEMO_ME.id }]
      save()
      await wait(null)
    },
    async updateRating(id, input) {
      store.ratings = store.ratings.map((r) =>
        r.id === id && r.userId === DEMO_ME.id ? { ...r, ...input, wineId: r.wineId, tastingId: r.tastingId } : r,
      )
      save()
      await wait(null)
    },
    async deleteRating(id) {
      store.ratings = store.ratings.filter((r) => !(r.id === id && r.userId === DEMO_ME.id))
      save()
      await wait(null)
    },
    async setRatingShared(id, shared) {
      store.ratings = store.ratings.map((r) => (r.id === id && r.userId === DEMO_ME.id ? { ...r, shared } : r))
      save()
      await wait(null)
    },

    ...createSocialMock({
      get: () => store,
      save,
      wait,
      toHit: (w) => toHit(w),
      withWine,
    }),
  }
}

/** Demo-Daten auf den Ausgangszustand zurücksetzen */
export function resetDemo() {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    // ignorieren
  }
}
