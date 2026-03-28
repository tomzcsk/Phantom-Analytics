import { useState, useEffect } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { useSite } from '../context/SiteContext'
import { useDateRange } from '../context/DateRangeContext'
import { useTimezone } from '../context/TimezoneContext'
import { apiGet } from '../lib/api'
import { DatePresets } from '../components/DatePresets'
import { RefreshButton } from '../components/RefreshButton'
import { format, parseISO } from 'date-fns'

interface EventRecord {
  id: string
  event_type: string
  url: string
  session_id: string
  country_code: string | null
  device_type: string | null
  custom_name: string | null
  timestamp: string
}

interface EventsResponse {
  data: EventRecord[]
  total: number
  page: number
  limit: number
  total_pages: number
}

const EVENT_TYPES = ['pageview', 'session_start', 'session_end', 'scroll', 'click', 'event', 'funnel_step']

export function EventExplorer() {
  const { activeSite } = useSite()
  const { range } = useDateRange()
  const { timezone } = useTimezone()
  const siteId = activeSite?.id ?? ''

  const [data, setData] = useState<EventsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filterType, setFilterType] = useState('')
  const [filterUrl, setFilterUrl] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    const params = new URLSearchParams({
      site_id: siteId,
      from: range.from,
      to: range.to,
      tz: timezone.value,
      page: String(page),
      limit: '50',
    })
    if (filterType) params.set('event_type', filterType)
    if (filterUrl) params.set('url', filterUrl)
    if (filterSession) params.set('session_id', filterSession)

    void apiGet<EventsResponse>(`/events?${params.toString()}`).then(setData).finally(() => setLoading(false))
  }, [siteId, range, timezone.value, page, filterType, filterUrl, filterSession, tick])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [filterType, filterUrl, filterSession, range])

  function handleSessionClick(sid: string) {
    setFilterSession(sid)
    setPage(1)
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Search size={20} style={{ color: 'var(--color-accent-purple)' }} />
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Event Explorer</h1>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={() => setTick((t) => t + 1)} />
          <DatePresets />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 pr-8 rounded-lg text-xs font-medium appearance-none outline-none"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: filterType ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)' }}
          >
            <option value="">ทุกประเภท</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
        </div>

        <input
          value={filterUrl}
          onChange={(e) => setFilterUrl(e.target.value)}
          placeholder="ค้นหา URL..."
          className="px-3 py-1.5 rounded-lg text-xs outline-none w-48"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        />

        {filterSession && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: 'var(--color-accent-purple)22', color: 'var(--color-accent-purple)', border: '1px solid var(--color-accent-purple)55' }}>
            <span className="font-mono">{filterSession}</span>
            <button onClick={() => setFilterSession('')} className="ml-1" style={{ color: 'var(--color-accent-purple)' }}>×</button>
          </div>
        )}

        {data && (
          <span className="text-xs ml-auto tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
            {data.total.toLocaleString()} เหตุการณ์
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        {loading ? (
          <div className="p-6">
            {[...Array(5)].map((_, i) => <div key={i} className="animate-pulse rounded h-10 mb-2" style={{ background: 'var(--color-bg-surface)' }} />)}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>ไม่พบเหตุการณ์ในช่วงนี้</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '14%' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left py-3 px-4 font-medium text-xs" style={{ color: 'var(--color-text-muted)' }}>เวลา</th>
                    <th className="text-left py-3 px-4 font-medium text-xs" style={{ color: 'var(--color-text-muted)' }}>ประเภท</th>
                    <th className="text-left py-3 px-4 font-medium text-xs" style={{ color: 'var(--color-text-muted)' }}>URL</th>
                    <th className="text-left py-3 px-4 font-medium text-xs" style={{ color: 'var(--color-text-muted)' }}>เซสชัน</th>
                    <th className="text-left py-3 px-4 font-medium text-xs" style={{ color: 'var(--color-text-muted)' }}>ประเทศ</th>
                    <th className="text-left py-3 px-4 font-medium text-xs" style={{ color: 'var(--color-text-muted)' }}>อุปกรณ์</th>
                    <th className="text-left py-3 px-4 font-medium text-xs" style={{ color: 'var(--color-text-muted)' }}>Custom</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((ev) => (
                    <tr key={ev.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="py-2.5 px-4 text-xs tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                        {format(parseISO(ev.timestamp), 'MMM d HH:mm:ss')}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-accent-blue)' }}>
                          {ev.event_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs truncate" style={{ color: 'var(--color-text-primary)' }} title={ev.url}>
                        {decodeURIComponent(ev.url.replace(/^https?:\/\/[^/]+/, '') || '/')}
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          onClick={() => handleSessionClick(ev.session_id)}
                          className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{ background: filterSession === ev.session_id ? 'var(--color-accent-purple)22' : 'transparent', color: 'var(--color-accent-purple)', cursor: 'pointer' }}
                        >
                          {ev.session_id}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {ev.country_code ?? '—'}
                      </td>
                      <td className="py-2.5 px-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {ev.device_type ?? '—'}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {ev.custom_name ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  หน้า {data.page}/{data.total_pages}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-2 py-1 rounded text-xs"
                    style={{ background: 'var(--color-bg-surface)', color: page <= 1 ? 'var(--color-text-muted)' : 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                  >
                    ‹ ก่อนหน้า
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                    disabled={page >= data.total_pages}
                    className="px-2 py-1 rounded text-xs"
                    style={{ background: 'var(--color-bg-surface)', color: page >= data.total_pages ? 'var(--color-text-muted)' : 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                  >
                    ถัดไป ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
