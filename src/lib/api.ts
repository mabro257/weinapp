import type {
  CommunityStats,
  Friend,
  FriendRating,
  Group,
  Member,
  Recommendation,
  Tasting,
  TastingProgress,
  Grape,
  GrapeCommunity,
  NewRating,
  NewWine,
  Profile,
  RatingWithWine,
  SavedWine,
  Wine,
  WineHit,
} from './types'
import { createMockApi } from './mockApi'
import { createSupabaseApi } from './supabaseApi'

/**
 * Eine Schnittstelle, zwei Umsetzungen: Ohne Supabase-Zugangsdaten läuft die App
 * im Demo-Modus mit Beispieldaten im Browser, mit Zugangsdaten gegen Supabase.
 */
export interface Api {
  mode: 'demo' | 'supabase'

  // Anmeldung
  getProfile(): Promise<Profile | null>
  onAuthChange(cb: () => void): () => void
  sendCode(email: string): Promise<void>
  verifyCode(email: string, code: string): Promise<void>
  signOut(): Promise<void>
  updateDisplayName(name: string): Promise<void>

  // Katalog
  searchWines(query: string): Promise<WineHit[]>
  findSimilarWines(name: string, winery: string): Promise<WineHit[]>
  getWine(id: number): Promise<Wine | null>
  createWine(input: NewWine): Promise<number>
  uploadLabel(wineId: number, file: Blob): Promise<void>
  wineCommunity(wineId: number): Promise<CommunityStats[]>

  // Rebsorten
  listGrapes(): Promise<Grape[]>
  grapeCommunity(): Promise<GrapeCommunity[]>

  // Merkliste (immer nur die eigene)
  savedWines(): Promise<SavedWine[]>
  isSaved(wineId: number): Promise<boolean>
  setSaved(wineId: number, saved: boolean): Promise<void>

  // Bewertungen (immer nur die eigenen)
  myRatings(): Promise<RatingWithWine[]>
  myTags(): Promise<string[]>
  createRating(input: NewRating): Promise<void>
  deleteRating(id: number): Promise<void>
  setRatingShared(id: number, shared: boolean): Promise<void>

  // Gruppen
  myGroups(): Promise<Group[]>
  groupMembers(groupId: number): Promise<Member[]>
  createGroup(name: string): Promise<Group>
  joinGroup(code: string): Promise<number>
  leaveGroup(groupId: number): Promise<void>
  friends(): Promise<Friend[]>
  /** geteilte Bewertungen aller Freunde aus den eigenen Gruppen */
  friendRatings(): Promise<FriendRating[]>

  // Empfehlungen
  recommendations(): Promise<Recommendation[]>
  recommend(wineId: number, toUserIds: string[], message: string | null): Promise<void>
  markRecommendationsSeen(): Promise<void>

  // Weinabende
  tastings(): Promise<Tasting[]>
  tasting(id: number): Promise<{ tasting: Tasting; wines: WineHit[]; progress: TastingProgress[] } | null>
  createTasting(groupId: number, title: string, eventDate: string): Promise<number>
  addTastingWine(tastingId: number, wineId: number): Promise<void>
  removeTastingWine(tastingId: number, wineId: number): Promise<void>
  revealTasting(tastingId: number): Promise<void>
  /** alle sichtbaren Bewertungen eines aufgelösten Abends (eigene und geteilte der anderen) */
  tastingRatings(tastingId: number): Promise<FriendRating[]>
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const api: Api = url && key ? createSupabaseApi(url, key) : createMockApi()
