import { useRealtime } from '../hooks/useRealtime'

interface RealtimePanelProps {
  siteId: string
}

function flagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1a5 + c.charCodeAt(0)))
    .join('')
}

export function RealtimePanel({ siteId }: RealtimePanelProps) {
  const { data, connected, reconnecting } = useRealtime({ siteId })

  const statusColor = reconnecting
    ? 'var(--color-accent-amber)'
    : connected
      ? 'var(--color-accent-green)'
      : 'var(--color-text-muted)'

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: statusColor, boxShadow: connected ? `0 0 6px ${statusColor}` : 'none' }}
        />
        <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
          {reconnecting ? 'กำลังเชื่อมต่อ…' : 'สด'}
        </span>
        {data && (
          <span
            className="ml-auto text-2xl font-bold tabular-nums"
            style={{ color: 'var(--color-text-primary)', fontFamily: "'JetBrains Mono', monospace" }}
          >
            {data.active_visitors}
          </span>
        )}
      </div>

      {/* Active pages */}
      {data && data.active_pages.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
            หน้าที่ใช้งานอยู่
          </p>
          <div className="flex flex-col gap-1">
            {data.active_pages.slice(0, 8).map((page) => (
              <div key={page.url} className="flex items-center justify-between gap-2 text-sm">
                <span
                  className="truncate"
                  style={{ color: 'var(--color-text-secondary)', maxWidth: '75%' }}
                  title={page.url}
                >
                  {decodeURIComponent(page.url.replace(/^https?:\/\/[^/]+/, '') || '/')}
                </span>
                <span className="font-medium tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {page.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent events */}
      {data && data.recent_events.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
            เหตุการณ์ล่าสุด
          </p>
          <div className="flex flex-col gap-1.5 overflow-hidden" style={{ maxHeight: 180 }}>
            {data.recent_events.slice(0, 10).map((ev, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {ev.country_code && (
                  <span style={{ fontSize: 14 }}>{flagEmoji(ev.country_code)}</span>
                )}
                <span
                  className="truncate flex-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title={ev.url}
                >
                  {decodeURIComponent(ev.url.replace(/^https?:\/\/[^/]+/, '') || '/')}
                </span>
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded text-xs"
                  style={{
                    background: 'var(--color-bg-surface)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {ev.event_type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data && !reconnecting && (
        <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
          รอรับเหตุการณ์สด…
        </p>
      )}
    </div>
  )
}
