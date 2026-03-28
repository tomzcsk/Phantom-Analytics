import { useState, useEffect, useRef } from 'react'
import { Bell, Target, AlertTriangle, TrendingUp, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import { apiGet, apiPut } from '../lib/api'

interface NotificationItem {
  id: string
  type: 'goal_reached' | 'goal_warning' | 'goal_exceeded'
  title: string
  read: boolean
  goal_name: string
  created_at: string
}

const TYPE_CONFIG = {
  goal_reached: { icon: Target, color: 'var(--color-accent-green)', label: 'ถึงเป้า' },
  goal_warning: { icon: AlertTriangle, color: 'var(--color-accent-amber)', label: 'เตือน' },
  goal_exceeded: { icon: TrendingUp, color: 'var(--color-accent-blue)', label: 'เกินเป้า' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'เมื่อกี้'
  if (mins < 60) return `${mins} นาทีที่แล้ว`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`
  const days = Math.floor(hrs / 24)
  return `${days} วันที่แล้ว`
}

export function NotificationBell() {
  const { activeSite } = useSite()
  const siteId = activeSite?.id ?? ''
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Fetch unread count every 30s
  useEffect(() => {
    if (!siteId) return
    const fetch = () => {
      void apiGet<{ count: number }>(`/notifications/unread-count?site_id=${siteId}`).then((r) => setUnread(r.count))
    }
    fetch()
    const id = setInterval(fetch, 30_000)
    return () => clearInterval(id)
  }, [siteId])

  // Fetch recent items when dropdown opens
  useEffect(() => {
    if (!open || !siteId) return
    void apiGet<NotificationItem[]>(`/notifications?site_id=${siteId}&limit=5`).then(setItems)
  }, [open, siteId])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleMarkRead(id: string) {
    await apiPut(`/notifications/${id}/read`, {})
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    setUnread((c) => Math.max(0, c - 1))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold"
            style={{ background: 'var(--color-accent-red)', color: '#fff' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>แจ้งเตือน</span>
            {unread > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-accent-red)', color: '#fff' }}>
                {unread} ใหม่
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>ไม่มีแจ้งเตือน</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.map((item) => {
                const cfg = TYPE_CONFIG[item.type]
                const Icon = cfg.icon
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer"
                    style={{
                      background: item.read ? 'transparent' : 'rgba(79,142,247,0.05)',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                    onClick={() => { void handleMarkRead(item.id); setOpen(false); navigate('/goals') }}
                  >
                    <div className="mt-0.5 p-1.5 rounded-lg shrink-0" style={{ background: `${cfg.color}20` }}>
                      <Icon size={14} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug" style={{ color: item.read ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                        {item.title}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {timeAgo(item.created_at)}
                      </p>
                    </div>
                    {!item.read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleMarkRead(item.id) }}
                        className="p-1 rounded shrink-0"
                        style={{ color: 'var(--color-text-muted)' }}
                        title="อ่านแล้ว"
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={() => { setOpen(false); navigate('/notifications') }}
            className="w-full px-4 py-2.5 text-xs font-medium text-center border-t transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent-blue)' }}
          >
            ดูทั้งหมด
          </button>
        </div>
      )}
    </div>
  )
}
