import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Edit3, Save, ChevronDown, Plus, Trash2, Link2, Shield } from 'lucide-react'
import { useSite } from '../context/SiteContext'
import { apiPut, apiPost, apiGet, apiDelete } from '../lib/api'
import { CopyButton } from '../components/CopyButton'
import { useAuth } from '../context/AuthContext'
import { FormModal } from '../components/FormModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { toastSuccess, toastError } from '../lib/toast'

const RETENTION_OPTIONS = [
  { value: null, label: 'ไม่จำกัด (เก็บตลอด)' },
  { value: 7, label: '7 วัน' },
  { value: 14, label: '14 วัน' },
  { value: 30, label: '30 วัน' },
  { value: 60, label: '60 วัน' },
  { value: 90, label: '90 วัน' },
  { value: 180, label: '180 วัน' },
  { value: 365, label: '365 วัน' },
] as const

interface ShareLinkItem {
  id: string
  token: string
  label: string
  expires_at: string
  created_at: string
}

function ShareLinksCard({ siteId }: { siteId: string }) {
  const { isDeveloper } = useAuth()
  const [links, setLinks] = useState<ShareLinkItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ShareLinkItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!siteId) return
    void apiGet<ShareLinkItem[]>(`/share-links?site_id=${siteId}`).then(setLinks)
  }, [siteId])

  async function handleCreate() {
    setSaving(true)
    try {
      const link = await apiPost<ShareLinkItem>('/share-links', { site_id: siteId, label, expires_days: 30 })
      setLinks((prev) => [link, ...prev])
      setShowForm(false)
      setLabel('')
      void toastSuccess('สร้าง share link สำเร็จ')
    } catch {
      void toastError('สร้าง share link ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/share-links/${deleteTarget.id}?site_id=${siteId}`)
      setLinks((prev) => prev.filter((l) => l.id !== deleteTarget.id))
      void toastSuccess('ลบ share link สำเร็จ')
    } catch {
      void toastError('ลบไม่สำเร็จ')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  function buildUrl(token: string) {
    return `${window.location.origin}/public/${token}`
  }

  if (!isDeveloper) return null

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 size={14} style={{ color: 'var(--color-accent-blue)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            แชร์ Dashboard
          </h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
        >
          <Plus size={12} /> สร้างลิงก์
        </button>
      </div>

      <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
        สร้างลิงก์สาธารณะเพื่อแชร์ข้อมูลภาพรวมโดยไม่ต้อง login (หมดอายุ 30 วัน)
      </p>

      <FormModal open={showForm} title="สร้าง Share Link" onClose={() => setShowForm(false)}>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>ชื่อลิงก์</p>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="เช่น สำหรับทีม Marketing"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void handleCreate()}
              disabled={saving || !label.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: saving || !label.trim() ? 0.6 : 1 }}
            >
              {saving ? 'กำลังสร้าง…' : 'สร้าง'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
              ยกเลิก
            </button>
          </div>
        </div>
      </FormModal>

      {links.length > 0 ? (
        <div className="flex flex-col gap-2">
          {links.map((link) => {
            const expired = new Date(link.expires_at) < new Date()
            return (
              <div
                key={link.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'var(--color-bg-surface)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: expired ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                    {link.label}
                    {expired && <span className="ml-2 text-xs" style={{ color: 'var(--color-accent-red)' }}>หมดอายุ</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!expired && <CopyButton text={buildUrl(link.token)} />}
                  <button
                    onClick={() => setDeleteTarget(link)}
                    className="p-1.5 rounded-lg"
                    style={{ color: 'var(--color-accent-red)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          ยังไม่มี share link — กดสร้างเพื่อแชร์ข้อมูลภาพรวม
        </p>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="ลบ Share Link"
        message={`ยืนยันลบลิงก์ "${deleteTarget?.label ?? ''}" หรือไม่? คนที่มี link จะเข้าถึงไม่ได้อีก`}
        confirmLabel="ลบ"
        danger
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function TwoFactorCard() {
  const [step, setStep] = useState<'idle' | 'setup' | 'confirm'>('idle')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [code, setCode] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDisable, setShowDisable] = useState(false)
  const [is2faEnabled, setIs2faEnabled] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    void apiGet<{ totp_enabled: boolean }>('/auth/me').then((user) => {
      setIs2faEnabled((user as unknown as { totp_enabled?: boolean }).totp_enabled ?? false)
      setChecking(false)
    }).catch(() => setChecking(false))
  }, [])

  async function handleSetup() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiPost<{ secret: string; otpauth_uri: string; backup_codes: string[] }>('/auth/2fa/setup', {})
      setOtpauthUri(res.otpauth_uri)
      setBackupCodes(res.backup_codes)
      setStep('setup')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      await apiPost('/auth/2fa/confirm', { code })
      setIs2faEnabled(true)
      setStep('idle')
      setCode('')
      void toastSuccess('เปิดใช้งาน 2FA สำเร็จ')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'รหัสไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisable() {
    setLoading(true)
    setError(null)
    try {
      await apiDelete('/auth/2fa', { password: disablePassword })
      setIs2faEnabled(false)
      setShowDisable(false)
      setDisablePassword('')
      void toastSuccess('ปิด 2FA สำเร็จ')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'รหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Shield size={14} style={{ color: is2faEnabled ? 'var(--color-accent-green)' : 'var(--color-text-muted)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          การยืนยันตัวตน 2 ขั้นตอน (2FA)
        </h2>
      </div>

      {is2faEnabled ? (
        <div>
          <p className="text-xs mb-3" style={{ color: 'var(--color-accent-green)' }}>
            เปิดใช้งานอยู่ — บัญชีของคุณได้รับการปกป้องด้วย authenticator app
          </p>
          {showDisable ? (
            <div className="flex flex-col gap-2">
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="ยืนยันรหัสผ่านเพื่อปิด 2FA"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
              {error && <p className="text-xs" style={{ color: 'var(--color-accent-red)' }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => void handleDisable()} disabled={loading || !disablePassword} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-accent-red)', color: '#fff', opacity: loading || !disablePassword ? 0.6 : 1 }}>
                  {loading ? 'กำลังปิด…' : 'ยืนยันปิด 2FA'}
                </button>
                <button onClick={() => { setShowDisable(false); setError(null) }} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowDisable(true)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--color-accent-red)', border: '1px solid var(--color-border)' }}>
              ปิด 2FA
            </button>
          )}
        </div>
      ) : step === 'idle' ? (
        <div>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
            เพิ่มความปลอดภัยด้วย authenticator app เช่น Google Authenticator หรือ Authy
          </p>
          <button onClick={() => void handleSetup()} disabled={loading} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'กำลังสร้าง…' : 'เปิดใช้งาน 2FA'}
          </button>
          {error && <p className="text-xs mt-2" style={{ color: 'var(--color-accent-red)' }}>{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              1. สแกน QR Code ด้วย authenticator app
            </p>
            <div className="rounded-lg p-4 text-center" style={{ background: 'var(--color-bg-surface)' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUri)}`}
                alt="QR Code"
                className="mx-auto"
                style={{ width: 160, height: 160 }}
              />
              <p className="text-xs mt-2 font-mono break-all" style={{ color: 'var(--color-text-muted)' }}>
                {otpauthUri.split('secret=')[1]?.split('&')[0] ?? ''}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              2. Backup Codes (เก็บไว้ที่ปลอดภัย)
            </p>
            <div className="grid grid-cols-2 gap-1">
              {backupCodes.map((c) => (
                <span key={c} className="text-xs font-mono px-2 py-1 rounded text-center" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              3. กรอกรหัส 6 หลักจาก app เพื่อยืนยัน
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none font-mono tracking-[0.3em] text-center"
                style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
              <button onClick={() => void handleConfirm()} disabled={loading || code.length !== 6} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: loading || code.length !== 6 ? 0.6 : 1 }}>
                {loading ? 'ตรวจสอบ…' : 'ยืนยัน'}
              </button>
            </div>
            {error && <p className="text-xs mt-2" style={{ color: 'var(--color-accent-red)' }}>{error}</p>}
          </div>

          <button onClick={() => { setStep('idle'); setError(null) }} className="text-xs self-start" style={{ color: 'var(--color-text-muted)' }}>
            ← ยกเลิก
          </button>
        </div>
      )}
    </div>
  )
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
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
          {code}
        </pre>
        <div className="absolute top-3 right-3">
          <CopyButton text={code} />
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

export function Settings() {
  const { isDeveloper } = useAuth()
  const { activeSite, refetch } = useSite()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingRetention, setSavingRetention] = useState(false)
  const [pendingRetention, setPendingRetention] = useState<number | null | false>(false)

  if (!activeSite) return null

  const snippet = `<script
  src="http://localhost/tracker.js"
  data-site-id="${activeSite.id}"
  data-token="${activeSite.tracking_token}"
  data-endpoint="http://localhost/api/collect"
  async
></script>`

  const nextjsSnippet = `// pages/_app.tsx
import { useEffect } from 'react'

// ใส่ใน component หลัก
useEffect(() => {
  if (window.__pa_loaded) return
  ;window.__pa_loaded = true
  ;window.__phantom_config = {
    siteId: '${activeSite.id}',
    token: '${activeSite.tracking_token}',
    endpoint: 'http://localhost/api/collect',
  }
  const s = document.createElement('script')
  s.src = 'http://localhost/tracker.js'
  document.head.appendChild(s)
}, [])`

  const clickExample = `<!-- ใส่ data-pa-click บน element ที่ต้องการ track -->
<button data-pa-click="signup_button">สมัครสมาชิก</button>
<a href="/pricing" data-pa-click="pricing_link">ดูราคา</a>

<!-- ลูกข้างในคลิกก็ track ให้ -->
<div data-pa-click="banner_click">
  <img src="banner.jpg" />
</div>`

  const eventExample = `// ส่ง custom event จาก JavaScript
phantom.track('signup', { plan: 'pro' })
phantom.track('purchase', { amount: 1990 })
phantom.track('video_complete', { video_id: 'intro' })

// สำหรับ TypeScript ใช้
;window.phantom.track('signup')`

  const funnelExample = `// ตัวอย่าง: track ขั้นตอนสมัครสมาชิก
// ใส่ในแต่ละจุดของ flow

// 1. ตอนกดปุ่มสมัคร
phantom.track('click_register')

// 2. ตอนขอ OTP สำเร็จ
phantom.track('request_otp')

// 3. ตอนยืนยัน OTP สำเร็จ
phantom.track('verify_otp')

// 4. ตอนสมัครเสร็จ
phantom.track('register_success')

// แล้วสร้าง "ช่องทาง" ใน dashboard
// เลือกประเภท "เหตุการณ์" ใส่ชื่อ event ตามลำดับ`

  function startEdit() {
    setName(activeSite!.name)
    setDomain(activeSite!.domain)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiPut(`/sites/${activeSite!.id}`, { name, domain })
      refetch()
      setEditing(false)
      void toastSuccess('บันทึกข้อมูลเว็บไซต์สำเร็จ')
    } catch {
      void toastError('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  function handleRetentionSelect(value: string) {
    const days = value === '' ? null : parseInt(value, 10)
    setPendingRetention(days)
  }

  async function handleRetentionConfirm() {
    if (pendingRetention === false) return
    setSavingRetention(true)
    try {
      await apiPut(`/sites/${activeSite!.id}`, { data_retention_days: pendingRetention })
      refetch()
      void toastSuccess('บันทึกนโยบายเก็บข้อมูลสำเร็จ')
    } catch {
      void toastError('บันทึกไม่สำเร็จ')
    } finally {
      setSavingRetention(false)
      setPendingRetention(false)
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon size={18} style={{ color: 'var(--color-text-secondary)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          ตั้งค่าเว็บไซต์
        </h1>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left column — Site info + Auto tracking */}
        <div className="flex flex-col gap-4">
          {/* Site info — editable */}
          <div
            className="rounded-xl p-5 flex flex-col gap-4"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                ข้อมูลเว็บไซต์
              </h2>
              {isDeveloper && (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ color: 'var(--color-accent-blue)', border: '1px solid var(--color-border)' }}
                >
                  <Edit3 size={12} /> แก้ไข
                </button>
              )}
            </div>

            <FormModal open={editing} title="แก้ไขข้อมูลเว็บไซต์" onClose={() => setEditing(false)} width="w-96">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>ชื่อเว็บไซต์</p>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>โดเมน</p>
                  <input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: saving ? 0.6 : 1 }}
                  >
                    <Save size={14} /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </FormModal>

              <div className="grid grid-cols-2 gap-4">
                <Field label="ชื่อเว็บไซต์">
                  <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{activeSite.name}</p>
                </Field>
                <Field label="โดเมน">
                  <p className="text-sm font-mono" style={{ color: 'var(--color-text-primary)' }}>{activeSite.domain}</p>
                </Field>
                <Field label="Site ID">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--color-text-secondary)' }}>{activeSite.id}</p>
                    <CopyButton text={activeSite.id} />
                  </div>
                </Field>
                <Field label="โทเคนติดตาม">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--color-accent-blue)' }}>{activeSite.tracking_token.slice(0, 16)}…</p>
                    <CopyButton text={activeSite.tracking_token} />
                  </div>
                </Field>
              </div>
          </div>

          {/* What gets tracked automatically */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              สิ่งที่ track อัตโนมัติ
            </h2>
            <div className="flex flex-col gap-2">
              {[
                { name: 'การเข้าชมหน้า', desc: 'ทุกครั้งที่เปิดหน้า หรือเปลี่ยนหน้าใน SPA' },
                { name: 'การเลื่อนดูหน้า', desc: 'ส่งค่า 0-100% ตอนออกจากหน้า' },
                { name: 'เวลาที่อยู่ในหน้า', desc: 'คำนวณตอนเปลี่ยนหน้าหรือปิดแท็บ' },
                { name: 'เซสชัน', desc: 'ใช้ fingerprint ไม่มี cookie หมดอายุหลัง 30 นาทีไม่ใช้งาน' },
              ].map((item) => (
                <div key={item.name} className="flex items-start gap-3 text-sm">
                  <span style={{ color: 'var(--color-accent-green)' }}>✓</span>
                  <div>
                    <span style={{ color: 'var(--color-text-primary)' }}>{item.name}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}> — {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Data Retention */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              นโยบายเก็บข้อมูล
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              กำหนดจำนวนวันที่เก็บข้อมูล events, sessions และ funnel events — ข้อมูลที่เก่ากว่าจะถูกลบอัตโนมัติ
            </p>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <select
                  value={activeSite.data_retention_days ?? ''}
                  onChange={(e) => handleRetentionSelect(e.target.value)}
                  disabled={!isDeveloper || savingRetention}
                  className="w-full px-3 py-2 pr-8 rounded-lg text-sm appearance-none outline-none"
                  style={{
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    cursor: isDeveloper ? 'pointer' : 'not-allowed',
                    opacity: savingRetention ? 0.6 : 1,
                  }}
                >
                  {RETENTION_OPTIONS.map((opt) => (
                    <option key={opt.value ?? 'null'} value={opt.value ?? ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--color-text-muted)' }}
                />
              </div>
              {savingRetention && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>กำลังบันทึก…</span>
              )}
            </div>
            {activeSite.data_retention_days && (
              <p className="text-xs mt-3" style={{ color: 'var(--color-accent-amber)' }}>
                ข้อมูลที่เก่ากว่า {activeSite.data_retention_days} วัน จะถูกลบอัตโนมัติทุกชั่วโมง
              </p>
            )}
          </div>

          <ConfirmDialog
            open={pendingRetention !== false}
            title="เปลี่ยนนโยบายเก็บข้อมูล"
            message={
              pendingRetention === null
                ? 'ยืนยันเปลี่ยนเป็น "ไม่จำกัด" — ข้อมูลจะถูกเก็บตลอดไป'
                : `ยืนยันตั้งค่าเก็บข้อมูล ${pendingRetention} วัน — ข้อมูลที่เก่ากว่าจะถูกลบถาวรภายใน 1 ชั่วโมง`
            }
            confirmLabel="ยืนยัน"
            danger={pendingRetention !== null}
            loading={savingRetention}
            onConfirm={() => void handleRetentionConfirm()}
            onCancel={() => setPendingRetention(false)}
          />

          {/* Share Links */}
          <ShareLinksCard siteId={activeSite.id} />
        </div>

        {/* Right column — 2FA + Installation + Usage examples */}
        <div className="flex flex-col gap-4">
          {/* Two-Factor Authentication */}
          <TwoFactorCard />

          {/* Installation */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              วิธีติดตั้ง
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              เลือกวิธีที่เหมาะกับเว็บของคุณ
            </p>

            <CodeBlock
              label="HTML ทั่วไป — เพิ่มใน <head>"
              code={snippet}
            />

            <CodeBlock
              label="Next.js / React SPA — ใส่ใน _app.tsx"
              code={nextjsSnippet}
            />
          </div>

          {/* Usage examples */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              ตัวอย่างการใช้งาน
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              ระบบจะ track การเข้าชมและเลื่อนหน้าอัตโนมัติ สำหรับ click และ event ใช้ตามตัวอย่างด้านล่าง
            </p>

            <CodeBlock
              label="Track การคลิก — ใส่ data-pa-click บน HTML element"
              code={clickExample}
            />

            <CodeBlock
              label="Track เหตุการณ์ — เรียก phantom.track() จาก JavaScript"
              code={eventExample}
            />

            <CodeBlock
              label="ตัวอย่าง: track ขั้นตอนสมัครสมาชิก (ใช้กับช่องทาง)"
              code={funnelExample}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
