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
  /** darf der aktuelle Nutzer den Wein bearbeiten (Admin oder eigener, noch ungeprüfter Eintrag) */
  editable?: boolean
}

/** Mögliche Dublette für die Admin-Prüfung */
export interface DuplicatePair {
  a: { id: number; name: string; winery: string | null; source: string; ratings: number }
  b: { id: number; name: string; winery: string | null; source: string; ratings: number }
  score: number
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
  /** für die eigenen Gruppen sichtbar */
  shared: boolean
  /** gehört zu einem Weinabend */
  tastingId: number | null
}

/** Bewertung samt Weininfos für Listen, Statistik und Decider */
export interface RatingWithWine extends Rating {
  wineName: string
  winery: string | null
  region: string | null
  country: string | null
  mainGrapeId: number | null
  /** neutrale Einordnung des Weins aus dem Katalog (nicht die eigene Angabe) */
  wineBody: number | null
  wineAcidity: number | null
  wineType: WineType | null
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
  shared: boolean
  tastingId: number | null
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

// ---------------------------------------------------------------------
// Soziales: Gruppen, Freunde, Empfehlungen, Weinabende
// ---------------------------------------------------------------------

export interface Group {
  id: number
  name: string
  inviteCode: string
  isAdmin: boolean
  memberCount: number
}

export interface Member {
  userId: string
  displayName: string
  role: 'admin' | 'member'
}

export interface Friend {
  userId: string
  displayName: string
}

/** Bewertung eines Freundes (nur geteilte, sichtbar über die Gruppen) */
export interface FriendRating extends RatingWithWine {
  userId: string
}

export interface Recommendation {
  id: number
  fromName: string
  toName: string
  incoming: boolean
  wine: WineHit
  message: string | null
  seen: boolean
  createdAt: string
}

export interface Tasting {
  id: number
  groupId: number
  groupName: string
  title: string
  eventDate: string
  hostId: string
  hostName: string
  status: 'offen' | 'aufgeloest'
}

export interface TastingProgress {
  userId: string
  displayName: string
  rated: number
}
