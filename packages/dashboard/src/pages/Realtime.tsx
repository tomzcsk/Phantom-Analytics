import { useSite } from '../context/SiteContext'
import { useRealtime } from '../hooks/useRealtime'

function flagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1a5 + c.charCodeAt(0)))
    .join('')
}

export function Realtime() {
  const { activeSite } = useSite()
  const siteId = activeSite?.id ?? ''
  const { data, connected, reconnecting } = useRealtime({ siteId })

  const statusColor = reconnecting
    ? 'var(--color-accent-amber)'
    : connected
      ? 'var(--color-accent-green)'
      : 'var(--color-text-muted)'

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          เรียลไทม์
        </h1>
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ background: statusColor, boxShadow: connected ? `0 0 8px ${statusColor}` : 'none' }}
        />
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {reconnecting ? 'กำลังเชื่อมต่อ…' : connected ? 'เชื่อมต่อแล้ว' : 'ไม่ได้เชื่อมต่อ'}
        </span>
      </div>

      {/* Active visitors count */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 mb-6">
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            ผู้เข้าชมขณะนี้
          </p>
          <p
            className="text-4xl font-bold tabular-nums"
            style={{ color: 'var(--color-accent-green)', fontFamily: "'JetBrains Mono', monospace" }}
          >
            {data?.active_visitors ?? 0}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            ใน 5 นาทีที่ผ่านมา
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Active pages */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            หน้าที่ใช้งานอยู่
          </h2>
          {data && data.active_pages.length > 0 ? (
            <div className="flex flex-col gap-2">
              {data.active_pages.map((pg) => {
                const maxCount = data.active_pages[0]?.count ?? 1
                const pct = Math.max(4, (pg.count / maxCount) * 100)
                return (
                  <div key={pg.url}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span
                        className="truncate"
                        style={{ color: 'var(--color-text-primary)', maxWidth: '80%' }}
                        title={pg.url}
                      >
                        {decodeURIComponent(pg.url.replace(/^https?:\/\/[^/]+/, '') || '/')}
                      </span>
                      <span className="tabular-nums font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        {pg.count}
                      </span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ background: 'var(--color-bg-surface)', height: 4 }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: 'var(--color-accent-blue)' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>ไม่มีหน้าที่ใช้งานอยู่ในขณะนี้</p>
          )}
        </div>

        {/* Event stream */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            สตรีมเหตุการณ์สด
          </h2>
          {data && data.recent_events.length > 0 ? (
            <div className="flex flex-col gap-2" style={{ maxHeight: 320, overflowY: 'auto' }}>
              {data.recent_events.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm py-1.5 rounded-lg px-2"
                  style={{ background: i === 0 ? 'var(--color-bg-surface)' : 'transparent' }}
                >
                  <span style={{ fontSize: 16 }}>
                    {ev.country_code ? flagEmoji(ev.country_code) : '🌐'}
                  </span>
                  <span
                    className="flex-1 truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                    title={ev.url}
                  >
                    {decodeURIComponent(ev.url.replace(/^https?:\/\/[^/]+/, '') || '/')}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-xs shrink-0"
                    style={{ background: 'var(--color-bg-surface)', color: 'var(--color-accent-blue)' }}
                  >
                    {ev.event_type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              รอรับเหตุการณ์…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
