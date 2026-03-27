import { useState } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { PageStat } from '@phantom/shared'

type SortKey = 'pageviews' | 'visitors' | 'bounce_rate' | 'avg_duration'
type SortDir = 'asc' | 'desc'

interface TopPagesTableProps {
  pages: PageStat[]
  loading?: boolean
}

function Sparkline({ data }: { data: number[] }) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width={80} height={28}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4F8EF7" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#4F8EF7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke="#4F8EF7" fill="url(#spGrad)" strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

const PAGE_SIZE = 20

export function TopPagesTable({ pages, loading = false }: TopPagesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('pageviews')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  if (loading) {
    return (
      <div
        className="rounded-xl animate-pulse"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', height: 320 }}
      />
    )
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  const sorted = [...pages].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey]
    return sortDir === 'desc' ? -diff : diff
  })

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const slice = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function SortIcon({ col }: { col: SortKey }) {
    if (col !== sortKey) return <span style={{ opacity: 0.3, fontSize: 10 }}>↕</span>
    return sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />
  }

  const thStyle = {
    color: 'var(--color-text-primary)',
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.02em',
    padding: '16px 16px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
  }

  if (pages.length === 0) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
          ไม่มีข้อมูลหน้าเว็บในช่วงนี้
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '35%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ ...thStyle, cursor: 'default', textAlign: 'left' }}>หน้า</th>
              <th style={thStyle} onClick={() => handleSort('pageviews')}>
                <span className="flex items-center justify-center gap-1">เข้าชม <SortIcon col="pageviews" /></span>
              </th>
              <th style={thStyle} onClick={() => handleSort('visitors')}>
                <span className="flex items-center justify-center gap-1">ผู้เข้าชม <SortIcon col="visitors" /></span>
              </th>
              <th style={thStyle} onClick={() => handleSort('bounce_rate')}>
                <span className="flex items-center justify-center gap-1">เข้าแล้วออก <SortIcon col="bounce_rate" /></span>
              </th>
              <th style={thStyle} onClick={() => handleSort('avg_duration')}>
                <span className="flex items-center justify-center gap-1">เวลาเฉลี่ย <SortIcon col="avg_duration" /></span>
              </th>
              <th style={{ ...thStyle, cursor: 'default' }}>แนวโน้ม 30 วัน</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((pg, i) => (
              <tr
                key={pg.url}
                style={{
                  borderBottom: i < slice.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <td style={{ padding: '10px 16px', textAlign: 'left', maxWidth: 280 }}>
                  <span
                    className="text-sm truncate block"
                    style={{ color: 'var(--color-text-primary)' }}
                    title={pg.url}
                  >
                    {decodeURIComponent(pg.url.replace(/^https?:\/\/[^/]+/, '') || '/')}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span className="text-sm tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                    {pg.pageviews.toLocaleString()}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span className="text-sm tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                    {pg.visitors.toLocaleString()}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span className="text-sm tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                    {(pg.bounce_rate * 100).toFixed(0)}%
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span className="text-sm tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatDuration(pg.avg_duration)}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <Sparkline data={pg.sparkline} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} จาก {sorted.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded text-xs"
              style={{
                background: 'var(--color-bg-surface)',
                color: page === 0 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              ‹ ก่อนหน้า
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded text-xs"
              style={{
                background: 'var(--color-bg-surface)',
                color: page >= totalPages - 1 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              ถัดไป ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
