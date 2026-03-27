import { useState } from 'react'
import { Settings as SettingsIcon, Edit3, Save } from 'lucide-react'
import { useSite } from '../context/SiteContext'
import { apiPut } from '../lib/api'
import { CopyButton } from '../components/CopyButton'
import { useAuth } from '../context/AuthContext'
import { FormModal } from '../components/FormModal'
import { toastSuccess, toastError } from '../lib/toast'

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
        </div>

        {/* Right column — Installation + Usage examples */}
        <div className="flex flex-col gap-4">
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
