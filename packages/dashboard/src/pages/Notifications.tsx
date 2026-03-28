import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Target, AlertTriangle, TrendingUp, CheckCheck } from 'lucide-react'
import { useSite } from '../context/SiteContext'
import { apiGet, apiPut } from '../lib/api'

interface NotificationItem {
  id: string
  type: 'goal_reached' | 'goal_warning' | 'goal_exceeded'
  title: string
  read: boolean
  goal_name: string
  goal_event: string
  created_at: string
}

type FilterType = 'all' | 'goal_reached' | 'goal_warning' | 'goal_exceeded'

const TYPE_CONFIG = {
  goal_reached: { icon: Target, color: 'var(--color-accent-green)', label: 'ถึงเป้า', bg: 'rgba(54,217,99,0.1)' },
  goal_warning: { icon: AlertTriangle, color: 'var(--color-accent-amber)', label: 'เตือน', bg: 'rgba(247,184,75,0.1)' },
  goal_exceeded: { icon: TrendingUp, color: 'var(--color-accent-blue)', label: 'เกินเป้า', bg: 'rgba(79,142,247,0.1)' },
}

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'goal_reached', label: 'ถึงเป้า' },
  { value: 'goal_exceeded', label: 'เกินเป้า' },
  { value: 'goal_warning', label: 'เตือน' },
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'เมื่อกี้'
  if (mins < 60) return `${mins} นาทีที่แล้ว`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} วันที่แล้ว`
  return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export function Notifications() {
  const { activeSite } = useSite()
  const siteId = activeSite?.id ?? ''
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    const typeParam = filter !== 'all' ? `&type=${filter}` : ''
    void apiGet<NotificationItem[]>(`/notifications?site_id=${siteId}&limit=100${typeParam}`)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [siteId, filter])

  async function handleMarkRead(id: string) {
    await apiPut(`/notifications/${id}/read`, {})
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  async function handleReadAll() {
    await apiPut(`/notifications/read-all?site_id=${siteId}`, {})
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const unreadCount = items.filter((n) => !n.read).length

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell size={20} style={{ color: 'var(--color-accent-blue)' }} />
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>แจ้งเตือน</h1>
          {unreadCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-accent-red)', color: '#fff' }}>
              {unreadCount} ใหม่
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => void handleReadAll()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ color: 'var(--color-accent-blue)', border: '1px solid var(--color-border)' }}
          >
            <CheckCheck size={14} /> อ่านทั้งหมด
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div
        className="flex items-center gap-1 rounded-lg p-1 mb-5 w-fit"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className="px-3 py-1 rounded-md text-sm font-medium transition-colors"
            style={{
              background: filter === f.value ? 'var(--color-bg-surface)' : 'transparent',
              color: filter === f.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl h-16" style={{ background: 'var(--color-bg-card)' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--color-bg-card)', border: '1px dashed var(--color-border)' }}>
          <Bell size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {filter === 'all' ? 'ยังไม่มีแจ้งเตือน — ระบบจะแจ้งเมื่อเป้าหมายถึง/ใกล้หมดเวลา' : 'ไม่มีแจ้งเตือนประเภทนี้'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const cfg = TYPE_CONFIG[item.type]
            const Icon = cfg.icon
            return (
              <div
                key={item.id}
                onClick={() => { void handleMarkRead(item.id); navigate('/goals') }}
                className="flex items-center gap-4 px-5 py-4 rounded-xl transition-colors cursor-pointer"
                style={{
                  background: item.read ? 'var(--color-bg-card)' : cfg.bg,
                  border: `1px solid ${item.read ? 'var(--color-border)' : cfg.color}40`,
                }}
              >
                <div className="p-2 rounded-lg shrink-0" style={{ background: `${cfg.color}20` }}>
                  <Icon size={18} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: item.read ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                    {item.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {item.goal_name} · {timeAgo(item.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${cfg.color}20`, color: cfg.color }}>
                    {cfg.label}
                  </span>
                  {!item.read && (
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-blue)' }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
