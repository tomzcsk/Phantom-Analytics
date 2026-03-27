import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--color-bg-base)' }}>
        <div className="rounded-xl p-8 text-center max-w-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>ลิงก์ไม่ถูกต้อง</p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>ไม่พบ token ใน URL กรุณาขอลิงก์ใหม่จากผู้ดูแลระบบ</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--color-bg-base)' }}>
        <div className="rounded-xl p-8 text-center max-w-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-accent-green)' }}>ตั้งรหัสผ่านใหม่สำเร็จ</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
          >
            ไปหน้า login
          </button>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    if (password !== confirm) {
      setError('รหัสผ่านไม่ตรงกัน')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center p-6" style={{ background: 'var(--color-bg-base)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <img src="/logo.png" alt="Phantom Analytics" className="w-10 h-10 rounded-xl" />
            <div className="flex">
              <span className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--color-accent-blue)' }}>Phantom</span>
              <span className="text-2xl font-semibold tracking-tight ml-1.5" style={{ color: 'var(--color-text-primary)' }}>Analytics</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-6" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            ตั้งรหัสผ่านใหม่
          </h2>
          <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
            กรอกรหัสผ่านใหม่ที่ต้องการใช้
          </p>

          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                รหัสผ่านใหม่
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="อย่างน้อย 8 ตัวอักษร"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                ยืนยันรหัสผ่านใหม่
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="กรอกอีกครั้ง"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>

            {error && <p className="text-sm" style={{ color: 'var(--color-accent-red)' }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
              style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'กำลังบันทึก…' : 'ตั้งรหัสผ่านใหม่'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
