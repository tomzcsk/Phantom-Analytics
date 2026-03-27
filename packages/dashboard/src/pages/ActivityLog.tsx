import { useState, useEffect, useCallback } from 'react'
import { ScrollText, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { apiGet } from '../lib/api'
import { useTimezone } from '../context/TimezoneContext'

interface LogEntry {
  id: string
  user_id: string
  user_name: string
  action: string
  entity_type: string
  entity_id: string | null
  description: string
  metadata: Record<string, unknown> | null
  site_id: string | null
  created_at: string
}

interface LogResponse {
  data: LogEntry[]
  total: number
  page: number
  limit: number
}

const ACTION_COLORS: Record<string, string> = {
  create: 'var(--color-accent-green)',
  update: 'var(--color-accent-blue)',
  delete: 'var(--color-accent-red)',
  login: 'var(--color-accent-purple)',
  logout: 'var(--color-text-muted)',
  login_failed: 'var(--color-accent-amber)',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'สร้าง',
  update: 'แก้ไข',
  delete: 'ลบ',
  login: 'เข้าสู่ระบบ',
  logout: 'ออกจากระบบ',
  login_failed: 'เข้าสู่ระบบล้มเหลว',
}

const ENTITY_LABELS: Record<string, string> = {
  site: 'เว็บไซต์',
  user: 'ผู้ใช้',
  funnel: 'ช่องทาง',
  click_variable: 'ตัวแปรคลิก',
  auth: 'การยืนยันตัวตน',
}

export function ActivityLog() {
  const { timezone } = useTimezone()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 20

  // Filters
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (filterAction) params.set('action', filterAction)
      if (filterEntity) params.set('entity_type', filterEntity)
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo) params.set('to', filterTo)
      const res = await apiGet<LogResponse>(`/activity-logs?${params}`)
      setLogs(res.data)
      setTotal(res.total)
    } catch {
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, filterAction, filterEntity, filterFrom, filterTo])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('th-TH', {
      timeZone: timezone.value,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <ScrollText size={18} style={{ color: 'var(--color-text-secondary)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Activity Log
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
          {total} รายการ
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1) }}
            className="px-3 py-1.5 pr-8 rounded-lg text-xs font-medium appearance-none"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <option value="">ทุก Action</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
        </div>

        <div className="relative">
          <select
            value={filterEntity}
            onChange={(e) => { setFilterEntity(e.target.value); setPage(1) }}
            className="px-3 py-1.5 pr-8 rounded-lg text-xs font-medium appearance-none"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <option value="">ทุกประเภท</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
        </div>

        <input
          type="date"
          value={filterFrom}
          onChange={(e) => { setFilterFrom(e.target.value); setPage(1) }}
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          placeholder="จาก"
        />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>ถึง</span>
        <input
          type="date"
          value={filterTo}
          onChange={(e) => { setFilterTo(e.target.value); setPage(1) }}
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          placeholder="ถึง"
        />

        {(filterAction || filterEntity || filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterAction(''); setFilterEntity(''); setFilterFrom(''); setFilterTo(''); setPage(1) }}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ color: 'var(--color-accent-red)', border: '1px solid var(--color-border)' }}
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-accent-blue)', borderTopColor: 'transparent' }} />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>ไม่มี Activity Log</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>เวลา</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>ผู้ใช้</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>Action</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>ประเภท</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                    {formatTime(log.created_at)}
                  </td>
                  <td className="px-5 py-3" style={{ color: 'var(--color-text-primary)' }}>
                    {log.user_name}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                      style={{
                        background: (ACTION_COLORS[log.action] ?? 'var(--color-text-muted)') + '1A',
                        color: ACTION_COLORS[log.action] ?? 'var(--color-text-muted)',
                      }}
                    >
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {ENTITY_LABELS[log.entity_type] ?? log.entity_type}
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {log.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            หน้า {page} / {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-lg"
              style={{ color: page <= 1 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg"
              style={{ color: page >= totalPages ? 'var(--color-text-muted)' : 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
