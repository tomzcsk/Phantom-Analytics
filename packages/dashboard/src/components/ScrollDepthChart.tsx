import type { ScrollDepthStat } from '@phantom/shared'

interface ScrollDepthChartProps {
  data: ScrollDepthStat[]
  loading?: boolean
}

function truncateUrl(url: string, max = 40): string {
  const path = decodeURIComponent(url.replace(/^https?:\/\/[^/]+/, '') || '/')
  if (path.length <= max) return path
  return path.slice(0, max - 1) + '\u2026'
}

/** Returns a color from red (0%) → yellow (50%) → green (100%) based on depth */
function depthColor(pct: number): string {
  if (pct >= 70) return '#36D963'
  if (pct >= 40) return '#F7B955'
  return '#F75252'
}

export function ScrollDepthChart({ data, loading = false }: ScrollDepthChartProps) {
  if (loading) {
    return (
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          ระดับการเลื่อน
        </h2>
        <div className="flex flex-col gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse rounded h-8" style={{ background: 'var(--color-bg-surface)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          ระดับการเลื่อน
        </h2>
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
          ไม่มีข้อมูลระดับการเลื่อนในช่วงนี้
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          ระดับการเลื่อน
        </h2>
        {/* Legend */}
        <div className="flex items-center gap-3">
          {[
            { color: '#F75252', label: '< 40%' },
            { color: '#F7B955', label: '40–70%' },
            { color: '#36D963', label: '> 70%' },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {data.map((row) => {
          const avg = Math.round(row.avg_max_depth)
          const color = depthColor(avg)
          return (
            <div key={row.url}>
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-sm truncate"
                  style={{ color: 'var(--color-text-primary)', maxWidth: 300 }}
                  title={row.url}
                >
                  {truncateUrl(row.url)}
                </span>
                <span
                  className="text-sm tabular-nums font-semibold ml-3 whitespace-nowrap"
                  style={{ color }}
                >
                  {avg}%
                </span>
              </div>
              <div
                className="rounded-md overflow-hidden"
                style={{ background: 'var(--color-bg-surface)', height: 6 }}
              >
                <div
                  className="h-full rounded-md transition-all"
                  style={{ width: `${avg}%`, background: color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
