export type WineType = 'rot' | 'weiss' | 'rose' | 'schaum'

export const WINE_TYPE_LABEL: Record<WineType, string> = {
  rot: 'Rotwein',
  weiss: 'Weißwein',
  rose: 'Rosé',
  schaum: 'Schaumwein',
}

export interface Grape {
  id: number
  name: string
  synonyms: string[]
  color: 'rot' | 'weiss'
  short: string | null
  aromas: string[]
  regions: string | null
  body: number | null
  acidity: number | null
  tannin: number | null
  food: string | null
}

export interface Wine {
  id: number
  name: string
  winery: string | null
  country: string | null
  region: string | null
  type: WineType | null
  priceClass: number | null
  /** Rebsorten-IDs, die erste ist die Hauptrebsorte */
  grapeIds: number[]
  body: number | null
  acidity: number | null
  labelUrl: string | null
}

export interface WineHit {
  id: number
  name: string
  winery: string | null
  region: string | null
  mainGrape: string | null
  myAvg: number | null
  type: WineType | null
  labelUrl: string | null
  /** gehört zu den besten Treffern der Suche (alle Suchbegriffe exakt enthalten) */
  best: boolean
}

/** Gemerkter Wein für die Merkliste im Profil */
export interface SavedWine extends WineHit {
  savedAt: string
}

export interface Rating {
  id: number
  wineId: number
  score: number
  vintage: number | null
  tastedOn: string // ISO-Datum JJJJ-MM-TT
  body: number | null
  acidity: number | null
  tannin: number | null
  note: string | null
  tags: string[]
}

/** Bewertung samt Weininfos für Listen, Statistik und Decider */
export interface RatingWithWine extends Rating {
  wineName: string
  winery: string | null
  region: string | null
  country: string | null
  mainGrapeId: number | null
}

export interface CommunityStats {
  /** null = alle Jahrgänge */
  vintage: number | null
  avg: number
  count: number
  raters: number
  body: number | null
  acidity: number | null
  tannin: number | null
}

export interface GrapeCommunity {
  grapeId: number
  avg: number
  count: number
}

export interface NewRating {
  wineId: number
  score: number
  vintage: number | null
  tastedOn: string
  body: number | null
  acidity: number | null
  tannin: number | null
  note: string | null
  tags: string[]
}

export interface NewWine {
  name: string
  winery: string | null
  country: string | null
  region: string | null
  type: WineType | null
  priceClass: number | null
  grapeIds: number[]
}

export interface Profile {
  id: string
  displayName: string
  isAdmin: boolean
}
