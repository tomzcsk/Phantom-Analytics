import { useState, useEffect } from 'react'
import { Plus, Trash2, Target, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
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
  status: 'on_track' | 'at_risk' | 'behind' | 'reached' | 'exceeded'
  pace_projected: number
  time_elapsed_pct: number
  previous_percentage: number | null
  created_at: string
}

interface HistoryPoint {
  period_start: string
  period_end: string
  actual_value: number
  target_value: number
  percentage: number
}

const PERIOD_LABELS: Record<string, string> = {
  daily: 'รายวัน',
  weekly: 'รายสัปดาห์',
  monthly: 'รายเดือน',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  reached: { label: 'ถึงเป้า', color: 'var(--color-accent-green)', bg: 'rgba(54,217,99,0.15)' },
  exceeded: { label: 'เกินเป้า', color: 'var(--color-accent-blue)', bg: 'rgba(79,142,247,0.15)' },
  on_track: { label: 'กำลังไปได้ดี', color: 'var(--color-accent-amber)', bg: 'rgba(247,184,75,0.15)' },
  at_risk: { label: 'เสี่ยง', color: '#F79B4B', bg: 'rgba(247,155,75,0.15)' },
  behind: { label: 'ต่ำกว่าเป้า', color: 'var(--color-accent-red)', bg: 'rgba(247,82,82,0.15)' },
}

function PaceText({ goal }: { goal: GoalWithProgress }) {
  const periodName = goal.period === 'daily' ? 'สิ้นวัน' : goal.period === 'weekly' ? 'สิ้นสัปดาห์' : 'สิ้นเดือน'

  if (goal.status === 'reached' || goal.status === 'exceeded') return null

  return (
    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
      คาดว่าจะได้ ~{goal.pace_projected.toLocaleString()} {periodName}
    </p>
  )
}

function PrevComparison({ goal }: { goal: GoalWithProgress }) {
  if (goal.previous_percentage === null) return null
  const diff = goal.percentage - goal.previous_percentage
  const periodName = goal.period === 'daily' ? 'เมื่อวาน' : goal.period === 'weekly' ? 'สัปดาห์ก่อน' : 'เดือนก่อน'

  if (diff > 0) return (
    <span className="inline-flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--color-accent-green)' }}>
      <TrendingUp size={11} /> +{Math.round(diff)}% จาก{periodName}
    </span>
  )
  if (diff < 0) return (
    <span className="inline-flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--color-accent-red)' }}>
      <TrendingDown size={11} /> {Math.round(diff)}% จาก{periodName}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
      <Minus size={11} /> เท่ากับ{periodName}
    </span>
  )
}

interface HistoryTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: { period_label: string; actual_value: number; target_value: number; percentage: number } }>
}

function HistoryTooltip({ active, payload }: HistoryTooltipProps) {
  if (!active || !payload || !payload[0]) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg px-3 py-2 text-sm shadow-lg" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{d.period_label}</p>
      <p className="font-semibold tabular-nums">{d.actual_value.toLocaleString()} / {d.target_value.toLocaleString()} ({d.percentage}%)</p>
    </div>
  )
}

function GoalHistory({ goalId }: { goalId: string }) {
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void apiGet<HistoryPoint[]>(`/goals/${goalId}/history?limit=8`)
      .then(setHistory)
      .finally(() => setLoading(false))
  }, [goalId])

  if (loading) return <div className="animate-pulse rounded h-40" style={{ background: 'var(--color-bg-surface)' }} />
  if (history.length === 0) return <p className="text-xs py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>ยังไม่มีข้อมูลย้อนหลัง — จะเริ่มเก็บเมื่อจบรอบแรก</p>

  const chartData = history.map((h) => ({
    ...h,
    period_label: `${new Date(h.period_start).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${new Date(h.period_end).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`,
    label: new Date(h.period_start).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
  }))

  const targetLine = history[0]?.target_value ?? 0

  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>ย้อนหลัง</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
          <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<HistoryTooltip />} />
          <ReferenceLine y={targetLine} stroke="var(--color-accent-blue)" strokeDasharray="4 4" strokeWidth={1.5} />
          <Bar dataKey="actual_value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.percentage >= 100 ? 'var(--color-accent-green)' : 'var(--color-accent-red)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
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
  const [expanded, setExpanded] = useState<string | null>(null)

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
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-accent-blue)', color: '#fff' }}>
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
            const cfg = (STATUS_CONFIG[goal.status] ?? STATUS_CONFIG['behind']) as { label: string; color: string; bg: string }
            const isExpanded = expanded === goal.id
            const progressColor = goal.status === 'reached' || goal.status === 'exceeded' ? 'var(--color-accent-green)' : cfg.color
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
                  <div className="flex items-center gap-2">
                    {/* Status badge */}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    {isDeveloper && (
                      <button onClick={() => setDeleteTarget(goal)} className="p-1.5 rounded-lg" style={{ color: 'var(--color-accent-red)' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-bold tabular-nums" style={{ color: progressColor, fontFamily: "'JetBrains Mono', monospace" }}>
                    {goal.current_value.toLocaleString()}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    / {goal.target_value.toLocaleString()}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="rounded-full overflow-hidden mb-1" style={{ background: 'var(--color-bg-surface)', height: 8 }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(goal.percentage, 100)}%`, background: progressColor }} />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs tabular-nums" style={{ color: progressColor }}>{goal.percentage}%</p>
                  <PrevComparison goal={goal} />
                </div>

                <PaceText goal={goal} />

                {/* Time elapsed bar */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-surface)', height: 3 }}>
                    <div className="h-full rounded-full" style={{ width: `${goal.time_elapsed_pct}%`, background: 'var(--color-text-muted)', opacity: 0.4 }} />
                  </div>
                  <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    เวลาผ่าน {goal.time_elapsed_pct}%
                  </span>
                </div>

                {/* Expand history button */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : goal.id)}
                  className="flex items-center gap-1 mt-3 text-xs"
                  style={{ color: 'var(--color-accent-blue)' }}
                >
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {isExpanded ? 'ซ่อนย้อนหลัง' : 'ดูย้อนหลัง'}
                </button>

                {isExpanded && <GoalHistory goalId={goal.id} />}
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
