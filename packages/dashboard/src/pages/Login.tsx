import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function TotpStep() {
  const { verifyTotp, cancelTotp } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await verifyTotp(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'รหัสไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
        ยืนยันตัวตน 2 ขั้นตอน
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
        กรอกรหัส 6 หลักจาก authenticator app หรือ backup code
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="000000"
          maxLength={8}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none text-center tracking-[0.3em] font-mono"
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            fontSize: 18,
          }}
        />

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-accent-red)' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
          style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: loading || code.length < 6 ? 0.6 : 1 }}
        >
          {loading ? 'กำลังตรวจสอบ…' : 'ยืนยัน'}
        </button>

        <button
          type="button"
          onClick={cancelTotp}
          className="text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← กลับไปหน้า login
        </button>
      </form>
    </div>
  )
}

export function Login() {
  const { login, isAuthenticated, loading: authLoading, totpPending } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (authLoading) {
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

  if (isAuthenticated) {
    return <Navigate to="/overview" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex h-screen items-center justify-center p-6"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <img src="/logo.png" alt="Phantom Analytics" className="w-10 h-10 rounded-xl" />
            <div className="flex">
              <span className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--color-accent-blue)' }}>
                Phantom
              </span>
              <span className="text-2xl font-semibold tracking-tight ml-1.5" style={{ color: 'var(--color-text-primary)' }}>
                Analytics
              </span>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            ข้อมูลของคุณ เซิร์ฟเวอร์ของคุณ กฎของคุณ
          </p>
        </div>

        {/* TOTP step or Login form */}
        {totpPending ? (
          <TotpStep />
        ) : (
          <div
            className="rounded-xl p-6"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--color-text-primary)' }}>
              เข้าสู่ระบบ
            </h2>

            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  ชื่อผู้ใช้
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="admin"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  รหัสผ่าน
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              {error && (
                <p className="text-sm" style={{ color: 'var(--color-accent-red)' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                style={{
                  background: 'var(--color-accent-blue)',
                  color: '#fff',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
