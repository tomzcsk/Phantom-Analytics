import { useState, useEffect } from 'react'
import { Plus, Trash2, Target, ChevronDown } from 'lucide-react'
import { useSite } from '../context/SiteContext'
import { apiGet, apiPost, apiDelete } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { FormModal } from '../components/FormModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { toastSuccess, toastError } from '../lib/toast'
import { RefreshButton } from '../components/RefreshButton'

interface GoalWithProgress {
  id: string
  name: string
  event_match: string
  target_value: number
  period: string
  current_value: number
  percentage: number
  created_at: string
}

const PERIOD_LABELS: Record<string, string> = {
  daily: 'รายวัน',
  weekly: 'รายสัปดาห์',
  monthly: 'รายเดือน',
}

export function Goals() {
  const { isDeveloper } = useAuth()
  const { activeSite } = useSite()
  const siteId = activeSite?.id ?? ''
  const [goals, setGoals] = useState<GoalWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GoalWithProgress | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [tick, setTick] = useState(0)

  // Create form
  const [name, setName] = useState('')
  const [eventMatch, setEventMatch] = useState('')
  const [targetValue, setTargetValue] = useState(100)
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    void apiGet<GoalWithProgress[]>(`/goals?site_id=${siteId}`).then(setGoals).finally(() => setLoading(false))
  }, [siteId, tick])

  async function handleCreate() {
    setSaving(true)
    try {
      await apiPost('/goals', { site_id: siteId, name, event_match: eventMatch, target_value: targetValue, period })
      setShowCreate(false)
      setName(''); setEventMatch(''); setTargetValue(100)
      setTick((t) => t + 1)
      void toastSuccess('สร้างเป้าหมายสำเร็จ')
    } catch {
      void toastError('สร้างเป้าหมายไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/goals/${deleteTarget.id}`)
      setTick((t) => t + 1)
      void toastSuccess('ลบเป้าหมายสำเร็จ')
    } catch {
      void toastError('ลบไม่สำเร็จ')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Target size={20} style={{ color: 'var(--color-accent-blue)' }} />
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>เป้าหมาย</h1>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={() => setTick((t) => t + 1)} />
          {isDeveloper && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
            >
              <Plus size={14} /> เป้าหมายใหม่
            </button>
          )}
        </div>
      </div>

      <FormModal open={showCreate} title="สร้างเป้าหมาย" onClose={() => setShowCreate(false)}>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>ชื่อเป้าหมาย</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น สมัครสมาชิก 100 คน" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Event ที่ match (event_type หรือ custom_name)</p>
            <input value={eventMatch} onChange={(e) => setEventMatch(e.target.value)} placeholder="เช่น signup, purchase" className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>จำนวนเป้า</p>
              <input type="number" value={targetValue} onChange={(e) => setTargetValue(parseInt(e.target.value) || 1)} min={1} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>ช่วงเวลา</p>
              <div className="relative">
                <select value={period} onChange={(e) => setPeriod(e.target.value as 'daily' | 'weekly' | 'monthly')} className="w-full px-3 py-2 pr-8 rounded-lg text-sm appearance-none outline-none" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                  <option value="daily">รายวัน</option>
                  <option value="weekly">รายสัปดาห์</option>
                  <option value="monthly">รายเดือน</option>
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void handleCreate()} disabled={saving || !name.trim() || !eventMatch.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: saving || !name.trim() || !eventMatch.trim() ? 0.6 : 1 }}>
              {saving ? 'กำลังสร้าง…' : 'สร้าง'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>ยกเลิก</button>
          </div>
        </div>
      </FormModal>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="animate-pulse rounded-xl h-24" style={{ background: 'var(--color-bg-card)' }} />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--color-bg-card)', border: '1px dashed var(--color-border)' }}>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>ยังไม่มีเป้าหมาย</p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>สร้างเป้าหมายเพื่อ track conversion ของเว็บไซต์</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {goals.map((goal) => {
            const isComplete = goal.percentage >= 100
            const color = isComplete ? 'var(--color-accent-green)' : 'var(--color-accent-blue)'
            return (
              <div key={goal.id} className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{goal.name}</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="font-mono" style={{ color: 'var(--color-accent-blue)' }}>{goal.event_match}</span>
                      {' · '}{PERIOD_LABELS[goal.period]}
                    </p>
                  </div>
                  {isDeveloper && (
                    <button onClick={() => setDeleteTarget(goal)} className="p-1.5 rounded-lg" style={{ color: 'var(--color-accent-red)' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-bold tabular-nums" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>
                    {goal.current_value.toLocaleString()}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    / {goal.target_value.toLocaleString()}
                  </span>
                </div>
                <div className="rounded-full overflow-hidden mb-1" style={{ background: 'var(--color-bg-surface)', height: 8 }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${goal.percentage}%`, background: color }} />
                </div>
                <p className="text-xs text-right tabular-nums" style={{ color }}>{goal.percentage}%</p>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="ลบเป้าหมาย"
        message={`ยืนยันลบเป้าหมาย "${deleteTarget?.name ?? ''}" หรือไม่?`}
        confirmLabel="ลบ"
        danger
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
