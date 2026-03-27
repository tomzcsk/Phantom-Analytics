import { useEffect, useState } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { apiFetch, setToken } from '../lib/api'
import { useAuth, type UserProfile } from '../context/AuthContext'

export function SharedLogin() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { isAuthenticated } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('ไม่พบ token ใน URL')
      setLoading(false)
      return
    }

    apiFetch<{ token: string; user: UserProfile }>('/auth/token-login', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        setToken(res.token)
        setDone(true)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'ลิงก์ไม่ถูกต้องหรือหมดอายุ')
      })
      .finally(() => setLoading(false))
  }, [token])

  if (done || isAuthenticated) {
    return <Navigate to="/overview" replace />
  }

  return (
    <div
      className="flex h-screen items-center justify-center p-6"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-6 text-center"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        {loading ? (
          <>
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
              style={{ borderColor: 'var(--color-accent-blue)', borderTopColor: 'transparent' }}
            />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              กำลังเข้าสู่ระบบ...
            </p>
          </>
        ) : error ? (
          <>
            <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-accent-red)' }}>
              เข้าสู่ระบบไม่สำเร็จ
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {error}
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}
