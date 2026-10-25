import { createContext, useContext, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api } from './lib/api'
import type { Grape, Profile } from './lib/types'
import { Loading } from './components/ui'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import WinePage from './pages/WinePage'
import RatePage from './pages/RatePage'
import NewWinePage from './pages/NewWinePage'
import DeciderPage from './pages/DeciderPage'
import GrapesPage from './pages/GrapesPage'
import TastePage from './pages/TastePage'
import FriendsPage from './pages/FriendsPage'
import GroupPage from './pages/GroupPage'
import JoinPage from './pages/JoinPage'
import TwinsPage from './pages/TwinsPage'
import BadgesPage from './pages/BadgesPage'
import TastingNewPage from './pages/TastingNewPage'
import TastingPage from './pages/TastingPage'
import GrapePage from './pages/GrapePage'
import HistoryPage from './pages/HistoryPage'
import DuplicatesPage from './pages/DuplicatesPage'
import RatingsPage from './pages/RatingsPage'
import IntroPage, { introDone } from './pages/IntroPage'

interface AppState {
  profile: Profile
  grapes: Grape[]
  refreshProfile: () => void
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp außerhalb von App')
  return v
}

/**
 * Zeigt neuen Nutzern einmal die Einführung (Merker im Profil). Während des Beitritts per Einladungslink
 * wird gewartet; danach kehrt die Einführung zur Seite zurück, auf der der Nutzer war (z. B. die Gruppe).
 */
function IntroGate() {
  const { profile } = useApp()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (profile.introSeen || introDone.current || pathname === '/intro' || pathname.startsWith('/beitreten/')) return
    navigate('/intro', { replace: true, state: { from: pathname } })
  }, [profile.introSeen, pathname, navigate])
  return null
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [grapes, setGrapes] = useState<Grape[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => api.onAuthChange(() => setTick((t) => t + 1)), [])

  useEffect(() => {
    let alive = true
    api
      .getProfile()
      .then(async (p) => {
        if (!alive) return
        setProfile(p)
        if (p) {
          const g = await api.listGrapes()
          if (alive) setGrapes(g)
        }
      })
      .catch(() => alive && setProfile(null))
    return () => {
      alive = false
    }
  }, [tick])

  if (profile === undefined) return <Loading />
  if (profile === null) return <LoginPage />

  return (
    <Ctx.Provider value={{ profile, grapes, refreshProfile: () => setTick((t) => t + 1) }}>
      <BrowserRouter>
        {api.mode === 'demo' && (
          <div className="bg-hero px-4 py-1.5 text-center text-xs font-semibold text-white">
            Demo-Modus mit Beispieldaten · Änderungen bleiben nur auf diesem Gerät
          </div>
        )}
        <IntroGate />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/wein/neu" element={<NewWinePage />} />
          <Route path="/wein/:id" element={<WinePage />} />
          <Route path="/wein/:id/bewerten" element={<RatePage />} />
          <Route path="/wein/:id/bearbeiten" element={<NewWinePage />} />
          <Route path="/dubletten" element={<DuplicatesPage />} />
          <Route path="/decider" element={<DeciderPage />} />
          <Route path="/geschmack" element={<TastePage />} />
          <Route path="/freunde" element={<FriendsPage />} />
          <Route path="/gruppe/:id" element={<GroupPage />} />
          <Route path="/beitreten/:code" element={<JoinPage />} />
          <Route path="/zwillinge" element={<TwinsPage />} />
          <Route path="/abzeichen" element={<BadgesPage />} />
          <Route path="/weinabend/neu" element={<TastingNewPage />} />
          <Route path="/weinabend/:id" element={<TastingPage />} />
          <Route path="/rebsorten" element={<GrapesPage />} />
          <Route path="/rebsorten/:id" element={<GrapePage />} />
          <Route path="/ich" element={<HistoryPage />} />
          <Route path="/ich/bewertungen" element={<RatingsPage />} />
          <Route path="/intro" element={<IntroPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Ctx.Provider>
  )
}
