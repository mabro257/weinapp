import type {
  CommunityStats,
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
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const api: Api = url && key ? createSupabaseApi(url, key) : createMockApi()
