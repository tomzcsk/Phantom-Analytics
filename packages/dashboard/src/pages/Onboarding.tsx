import { useState } from 'react'
import { Check, Globe } from 'lucide-react'
import { useSite } from '../context/SiteContext'
import { apiPost, apiGet } from '../lib/api'
import { CopyButton } from '../components/CopyButton'

interface RegisterFormProps {
  onSuccess: () => void
}

function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await apiPost('/sites', { name, domain })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          ชื่อเว็บไซต์
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เว็บไซต์ของฉัน"
          required
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
          โดเมน
        </label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          required
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
        className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity"
        style={{
          background: 'var(--color-accent-blue)',
          color: '#fff',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'กำลังลงทะเบียน…' : 'ลงทะเบียนเว็บไซต์'}
      </button>
    </form>
  )
}

export function Onboarding() {
  const { refetch } = useSite()
  const [registered, setRegistered] = useState(false)
  const [siteToken, setSiteToken] = useState<string | null>(null)
  const [siteId, setSiteId] = useState<string | null>(null)

  async function handleRegisterSuccess() {
    // Refetch sites to get the new token
    const sites = await apiGet<Array<{ id: string; tracking_token: string; domain: string }>>('/sites')
    const newest = sites[sites.length - 1]
    if (newest) {
      setSiteId(newest.id)
      setSiteToken(newest.tracking_token)
    }
    setRegistered(true)
    refetch()
  }

  const snippet = siteId && siteToken
    ? `<script\n  src="/tracker.js"\n  data-site-id="${siteId}"\n  data-token="${siteToken}"\n  async\n></script>`
    : null

  return (
    <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'var(--color-bg-base)' }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: 'var(--color-accent-blue)', opacity: 0.15 }}
          >
            <Globe size={24} style={{ color: 'var(--color-accent-blue)', opacity: 1 }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            ยินดีต้อนรับสู่ Phantom Analytics
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            ข้อมูลของคุณ เซิร์ฟเวอร์ของคุณ กฎของคุณ
          </p>
        </div>

        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          {!registered ? (
            <>
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                ลงทะเบียนเว็บไซต์แรกของคุณ
              </h2>
              <RegisterForm onSuccess={() => void handleRegisterSuccess()} />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Check size={16} style={{ color: 'var(--color-accent-green)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  ลงทะเบียนเว็บไซต์สำเร็จ!
                </h2>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                เพิ่มโค้ดนี้ใน <code style={{ color: 'var(--color-accent-blue)' }}>&lt;head&gt;</code> ของเว็บไซต์เพื่อเริ่มติดตาม:
              </p>
              {snippet && (
                <div className="relative">
                  <pre
                    className="rounded-lg p-4 text-xs overflow-x-auto"
                    style={{
                      background: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      fontFamily: "'JetBrains Mono', monospace",
                      lineHeight: 1.6,
                    }}
                  >
                    {snippet}
                  </pre>
                  <div className="absolute top-3 right-3">
                    <CopyButton text={snippet} />
                  </div>
                </div>
              )}
              <p className="text-xs mt-4" style={{ color: 'var(--color-text-muted)' }}>
                เหตุการณ์จะปรากฏในแดชบอร์ดภายในไม่กี่วินาทีหลังจากการเข้าชมครั้งแรก
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
