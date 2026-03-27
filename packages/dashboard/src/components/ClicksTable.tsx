import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { ClickStat } from '@phantom/shared'

type SortKey = 'click_count' | 'unique_clickers'
type SortDir = 'asc' | 'desc'

interface ClicksTableProps {
  clicks: ClickStat[]
  loading?: boolean
  nameMap?: Map<string, string>
}

function truncateUrl(url: string, max = 40): string {
  const path = decodeURIComponent(url.replace(/^https?:\/\/[^/]+/, '') || '/')
  if (path.length <= max) return path
  return path.slice(0, max - 1) + '\u2026'
}

const PAGE_SIZE = 20

export function ClicksTable({ clicks, loading = false, nameMap }: ClicksTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('click_count')
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

  if (clicks.length === 0) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
          ไม่มีข้อมูลการคลิกในช่วงนี้
        </p>
      </div>
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

  const sorted = [...clicks].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey]
    return sortDir === 'desc' ? -diff : diff
  })

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const slice = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function SortIcon({ col }: { col: SortKey }) {
    if (col !== sortKey) return <span style={{ opacity: 0.3, fontSize: 10 }}>&#8597;</span>
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

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '28%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ ...thStyle, cursor: 'default' }}>ตัวแปร</th>
              <th style={{ ...thStyle, cursor: 'default' }}>URL หน้า</th>
              <th style={thStyle} onClick={() => handleSort('click_count')}>
                <span className="flex items-center justify-center gap-1">คลิก <SortIcon col="click_count" /></span>
              </th>
              <th style={thStyle} onClick={() => handleSort('unique_clickers')}>
                <span className="flex items-center justify-center gap-1">ไม่ซ้ำ <SortIcon col="unique_clickers" /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr
                key={`${row.element_id}-${row.url}`}
                style={{
                  borderBottom: i < slice.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <td style={{ padding: '10px 16px', textAlign: 'center', maxWidth: 200 }}>
                  {nameMap?.get(row.element_id) ? (
                    <div>
                      <span className="text-sm block" style={{ color: 'var(--color-text-primary)' }}>
                        {nameMap.get(row.element_id)}
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        {row.element_id}
                      </span>
                    </div>
                  ) : (
                    <span
                      className="text-sm font-mono truncate block"
                      style={{ color: 'var(--color-accent-blue)' }}
                      title={row.element_id}
                    >
                      {row.element_id}
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center', maxWidth: 280 }}>
                  <span
                    className="text-sm truncate block"
                    style={{ color: 'var(--color-text-primary)' }}
                    title={row.url}
                  >
                    {truncateUrl(row.url)}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span className="text-sm tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                    {row.click_count.toLocaleString()}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span className="text-sm tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                    {row.unique_clickers.toLocaleString()}
                  </span>
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
              &#8249; ก่อนหน้า
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
              ถัดไป &#8250;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
