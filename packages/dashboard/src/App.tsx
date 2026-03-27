import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useSite } from './context/SiteContext'
import { AuthGuard } from './components/AuthGuard'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { Overview } from './pages/Overview'
import { Pages } from './pages/Pages'
import { Sources } from './pages/Sources'
import { Funnels } from './pages/Funnels'
import { Engagement } from './pages/Engagement'
import { Journeys } from './pages/Journeys'
import { Onboarding } from './pages/Onboarding'
import { Settings } from './pages/Settings'
import { Login } from './pages/Login'
import { UserManagement } from './pages/UserManagement'
import { ActivityLog } from './pages/ActivityLog'
import { SharedLogin } from './pages/SharedLogin'

function LoadingSpinner() {
  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--color-accent-blue)', borderTopColor: 'transparent' }}
      />
    </div>
  )
}

/**
 * Authenticated dashboard layout.
 * Shows onboarding when no sites are registered (E5-F9).
 * Otherwise renders sidebar + main content area.
 */
function NoSiteAccess() {
  const { logout } = useAuth()
  return (
    <div className="flex h-screen items-center justify-center" style={{ background: 'var(--color-bg-base)' }}>
      <div className="rounded-xl p-8 text-center max-w-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          ยังไม่มีเว็บไซต์ที่เข้าถึงได้
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดเว็บไซต์ให้บัญชีของคุณ
        </p>
        <button
          onClick={logout}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}

function DashboardLayout() {
  const { isAdmin } = useAuth()
  const { sites, loading } = useSite()

  if (loading) {
    return <LoadingSpinner />
  }

  // No sites: admin sees onboarding, others see "no access" message
  if (sites.length === 0) {
    return isAdmin ? <Onboarding /> : <NoSiteAccess />
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg-base)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/pages" element={<Pages />} />
          <Route path="/engagement" element={<Engagement />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/funnels" element={<Funnels />} />
          <Route path="/journeys" element={<Journeys />} />
          <Route path="/settings" element={<AuthGuard requiredRole="developer"><Settings /></AuthGuard>} />
          <Route
            path="/users"
            element={
              <AuthGuard requiredRole="admin">
                <UserManagement />
              </AuthGuard>
            }
          />
          <Route
            path="/activity-log"
            element={
              <AuthGuard requiredRole="admin">
                <ActivityLog />
              </AuthGuard>
            }
          />
        </Routes>
        </main>
      </div>
    </div>
  )
}

/**
 * Root application with auth routing.
 * Public: /login
 * Protected: everything else
 */
export function App() {
  const { loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/shared" element={<SharedLogin />} />
      <Route
        path="/*"
        element={
          <AuthGuard>
            <DashboardLayout />
          </AuthGuard>
        }
      />
    </Routes>
  )
}
