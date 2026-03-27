import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Code } from 'lucide-react'
import { CopyButton } from '../components/CopyButton'
import { useQueryClient } from '@tanstack/react-query'
import { useSite } from '../context/SiteContext'
import { apiPost, apiDelete } from '../lib/api'
import { useDateRange } from '../context/DateRangeContext'
import { useFunnels, useFunnel } from '../hooks/useAnalytics'
import { FunnelChart } from '../components/FunnelChart'
import { DatePresets } from '../components/DatePresets'
import { RefreshButton } from '../components/RefreshButton'
import { ExportButton } from '../components/ExportButton'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FormModal } from '../components/FormModal'
import { toastSuccess, toastError } from '../lib/toast'
import { useAuth } from '../context/AuthContext'
import type { FunnelDef } from '../hooks/useAnalytics'
import type { FunnelStep } from '@phantom/shared'

type StepType = 'page_url' | 'event_name'

interface BuilderStep {
  label: string
  type: StepType
  value: string
}

function FunnelBuilder({ siteId, onSaved }: { siteId: string; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [steps, setSteps] = useState<BuilderStep[]>([
    { label: '', type: 'page_url', value: '' },
    { label: '', type: 'page_url', value: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const qc = useQueryClient()

  function addStep() {
    setSteps((prev) => [...prev, { label: '', type: 'page_url', value: '' }])
  }

  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i))
  }

  function moveStep(i: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev]
      const target = i + dir
      if (target < 0 || target >= next.length) return prev
      const tmp = next[i]!
      next[i] = next[target]!
      next[target] = tmp
      return next
    })
  }

  function updateStep(i: number, field: keyof BuilderStep, val: string) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)))
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    setShowConfirm(true)
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const payload = {
        site_id: siteId,
        name,
        steps: steps.map((s, i) => ({ index: i, label: s.label || s.value, type: s.type, value: s.value })),
      }
      await apiPost('/funnels', payload)
      await qc.invalidateQueries({ queryKey: ['funnels', siteId] })
      onSaved()
      void toastSuccess('สร้างช่องทางสำเร็จ')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      void toastError('สร้างช่องทางไม่สำเร็จ', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          ชื่อช่องทาง
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="เช่น ขั้นตอนสมัครสมาชิก"
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          ขั้นตอน (ขั้นต่ำ 2, สูงสุด 10)
        </label>
        <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs w-5 shrink-0 text-center" style={{ color: 'var(--color-text-muted)' }}>
                {i + 1}
              </span>
              <div className="relative shrink-0" style={{ width: 110 }}>
                <select
                  value={step.type}
                  onChange={(e) => updateStep(i, 'type', e.target.value)}
                  className="w-full px-2.5 py-1.5 pr-7 rounded-lg text-xs font-medium appearance-none"
                  style={{
                    background: 'var(--color-accent-blue)',
                    border: '1px solid var(--color-accent-blue)',
                    color: '#fff',
                    opacity: 0.85,
                  }}
                >
                  <option value="page_url">URL หน้า</option>
                  <option value="event_name">เหตุการณ์</option>
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: '#fff' }}
                />
              </div>
              <input
                value={step.value}
                onChange={(e) => updateStep(i, 'value', e.target.value)}
                required
                placeholder={step.type === 'page_url' ? '/path' : 'event_name'}
                className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none"
                style={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
              <input
                value={step.label}
                onChange={(e) => updateStep(i, 'label', e.target.value)}
                placeholder="ป้ายกำกับ (ไม่บังคับ)"
                className="w-28 px-2 py-1.5 rounded-lg text-sm outline-none"
                style={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
              <div className="flex gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveStep(i, -1)}
                  disabled={i === 0}
                  className="p-1 rounded"
                  style={{ color: i === 0 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(i, 1)}
                  disabled={i === steps.length - 1}
                  className="p-1 rounded"
                  style={{ color: i === steps.length - 1 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  disabled={steps.length <= 2}
                  className="p-1 rounded"
                  style={{ color: steps.length <= 2 ? 'var(--color-text-muted)' : 'var(--color-accent-red)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {steps.length < 10 && (
          <button
            type="button"
            onClick={addStep}
            className="mt-2 flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
            style={{
              color: 'var(--color-accent-blue)',
              border: '1px dashed var(--color-border)',
              background: 'transparent',
            }}
          >
            <Plus size={14} />
            เพิ่มขั้นตอน
          </button>
        )}
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--color-accent-red)' }}>{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึกช่องทาง'}
        </button>
        <button
          type="button"
          onClick={onSaved}
          className="px-4 py-2 rounded-lg text-sm"
          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
        >
          ยกเลิก
        </button>
      </div>
      <ConfirmDialog
        open={showConfirm}
        title="สร้างช่องทางใหม่"
        message={`ยืนยันสร้างช่องทาง "${name}" (${steps.length} ขั้นตอน) หรือไม่?`}
        confirmLabel="สร้าง"
        loading={saving}
        onConfirm={() => void handleSave()}
        onCancel={() => setShowConfirm(false)}
      />
    </form>
  )
}

function CopyBtn({ text }: { text: string }) {
  return <CopyButton text={text} size="sm" />
}

function FunnelCodeGuide({ steps }: { steps: FunnelStep[] }) {
  const [show, setShow] = useState(false)

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 text-sm font-semibold w-full"
        style={{ color: 'var(--color-text-primary)' }}
      >
        <Code size={14} style={{ color: 'var(--color-accent-blue)' }} />
        โค้ดสำหรับ track ช่องทางนี้
        <span className="ml-auto text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {show ? '▲ ซ่อน' : '▼ แสดง'}
        </span>
      </button>
      {show && (
        <div className="flex flex-col gap-3 mt-4">
          {steps.map((step, i) => {
            const code = step.type === 'page_url'
              ? `<!-- ผู้ใช้เข้าหน้า ${step.value} จะถูก track อัตโนมัติ -->`
              : `phantom.track('${step.value}')\n\n// TypeScript:\n;window.phantom.track('${step.value}')`

            const htmlCode = step.type === 'event_name'
              ? `<button data-pa-click="${step.value}">${step.label}</button>`
              : null

            return (
              <div key={i}>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  ขั้นตอนที่ {i + 1}: {step.label}
                  <span className="ml-2 px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-muted)', fontSize: 10 }}>
                    {step.type === 'page_url' ? 'URL หน้า' : 'เหตุการณ์'}
                  </span>
                </p>
                <div className="relative">
                  <pre
                    className="rounded-lg p-3 text-xs overflow-x-auto"
                    style={{
                      background: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      fontFamily: "'JetBrains Mono', monospace",
                      lineHeight: 1.6,
                    }}
                  >
                    {code}{htmlCode ? `\n\n// หรือใช้ HTML:\n${htmlCode}` : ''}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyBtn text={step.type === 'page_url' ? step.value : `phantom.track('${step.value}')`} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FunnelView({ funnel, siteId }: { funnel: FunnelDef; siteId: string }) {
  const { range } = useDateRange()
  const { isDeveloper } = useAuth()
  const { data, isLoading } = useFunnel(funnel.id, siteId, range)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const qc = useQueryClient()

  async function handleDelete() {
    setDeleting(true)
    try {
      await apiDelete(`/funnels/${funnel.id}`)
      await qc.invalidateQueries({ queryKey: ['funnels', siteId] })
      void toastSuccess('ลบช่องทางสำเร็จ')
    } catch {
      void toastError('ลบช่องทางไม่สำเร็จ')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {funnel.name}
        </h2>
        <div className="flex items-center gap-2">
          <ExportButton
            headers={['ขั้นตอน', 'ประเภท', 'ค่า', 'เข้า', 'ผ่าน', 'อัตราแปลง (%)', 'อัตราออก (%)']}
            rows={(data?.steps ?? []).map((s) => [s.label, s.type, s.value, s.entered, s.completed, (s.conversion_rate * 100).toFixed(1), (s.drop_off_rate * 100).toFixed(1)])}
            filename={`funnel-${funnel.name}-${range.from}_${range.to}`}
            disabled={isLoading || (data?.steps ?? []).length === 0}
          />
          {isDeveloper && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded"
              style={{ color: 'var(--color-accent-red)', border: '1px solid var(--color-border)' }}
            >
              <Trash2 size={12} />
              ลบ
            </button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="ลบช่องทาง"
        message={`ยืนยันลบช่องทาง "${funnel.name}" หรือไม่? ข้อมูลจะหายไปถาวร`}
        confirmLabel="ลบ"
        danger
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <FunnelChart funnel={data ?? null} loading={isLoading} />
      {isDeveloper && <FunnelCodeGuide steps={funnel.steps} />}
    </div>
  )
}

export function Funnels() {
  const { isDeveloper } = useAuth()
  const { activeSite } = useSite()
  const siteId = activeSite?.id ?? ''
  const { data: funnels, isLoading } = useFunnels(siteId)
  const [showBuilder, setShowBuilder] = useState(false)
  const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null)

  const activeFunnel = funnels?.find((f) => f.id === activeFunnelId) ?? funnels?.[0] ?? null

  // Auto-select first funnel
  if (funnels && funnels.length > 0 && !activeFunnelId && !showBuilder) {
    setActiveFunnelId(funnels[0]!.id)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          ช่องทาง
        </h1>
        <div className="flex items-center gap-3">
          <RefreshButton />
          <DatePresets />
          {isDeveloper && (
            <button
              onClick={() => setShowBuilder(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
            >
              <Plus size={14} />
              ช่องทางใหม่
            </button>
          )}
        </div>
      </div>

      <FormModal open={showBuilder} title="ช่องทางใหม่" onClose={() => setShowBuilder(false)} width="w-[48rem]">
        <FunnelBuilder siteId={siteId} onSaved={() => setShowBuilder(false)} />
      </FormModal>

      {isLoading ? (
        <div className="animate-pulse rounded-xl h-48" style={{ background: 'var(--color-bg-card)' }} />
      ) : (funnels ?? []).length === 0 ? (
        !showBuilder && (
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: 'var(--color-bg-card)', border: '1px dashed var(--color-border)' }}
          >
            <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              ยังไม่มีช่องทาง
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
              สร้างช่องทางเพื่อติดตามอัตราการแปลงผ่านลำดับขั้นตอนต่างๆ
            </p>
            {isDeveloper && (
              <button
                onClick={() => setShowBuilder(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
              >
                สร้างช่องทางแรกของคุณ
              </button>
            )}
          </div>
        )
      ) : (
        <div className="flex gap-5">
          {/* Funnel list sidebar */}
          <div
            className="w-48 shrink-0 rounded-xl p-3 flex flex-col gap-1"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', height: 'fit-content' }}
          >
            {funnels!.map((f) => (
              <button
                key={f.id}
                onClick={() => { setActiveFunnelId(f.id); setShowBuilder(false) }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors"
                style={{
                  background: activeFunnelId === f.id ? 'var(--color-bg-surface)' : 'transparent',
                  color: activeFunnelId === f.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {f.name}
              </button>
            ))}
          </div>

          {/* Active funnel view */}
          <div className="flex-1">
            {activeFunnel && <FunnelView funnel={activeFunnel} siteId={siteId} />}
          </div>
        </div>
      )}
    </div>
  )
}
