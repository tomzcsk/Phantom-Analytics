import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'developer' | 'viewer'
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) {
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const hasRole =
    requiredRole === 'admin'
      ? user?.role === 'admin'
      : requiredRole === 'developer'
        ? user?.role === 'admin' || user?.role === 'developer'
        : true

  if (requiredRole && !hasRole) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: 'var(--color-bg-base)' }}
      >
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-accent-red)' }}>
            ไม่มีสิทธิ์เข้าถึง
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบ
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
