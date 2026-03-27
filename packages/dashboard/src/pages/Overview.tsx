import { useState, useEffect } from 'react'
import { useSite } from '../context/SiteContext'
import { useDateRange } from '../context/DateRangeContext'
import type { DatePreset } from '../context/DateRangeContext'
import { useOverview, useTimeseries } from '../hooks/useAnalytics'
import { useRealtime } from '../hooks/useRealtime'
import { KPICard } from '../components/KPICard'
import { TrendChart } from '../components/TrendChart'
import { DatePresets } from '../components/DatePresets'
import { RefreshButton } from '../components/RefreshButton'

function timeAgoText(ts: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000))
  if (diff < 5) return 'ตอนนี้'
  if (diff < 60) return `${diff} วิ ที่แล้ว`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  return `${h} ชม. ที่แล้ว`
}

function TimeAgo({ timestamp }: { timestamp: string }) {
  const [text, setText] = useState(() => timeAgoText(timestamp))
  useEffect(() => {
    setText(timeAgoText(timestamp))
    const id = setInterval(() => setText(timeAgoText(timestamp)), 10_000)
    return () => clearInterval(id)
  }, [timestamp])
  return <>{text}</>
}

const PRESET_DAYS: Record<DatePreset, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 }

export function Overview() {
  const { activeSite } = useSite()
  const { range, preset } = useDateRange()

  const siteId = activeSite?.id ?? ''
  const { data: overview, isLoading: ovLoading, isFetching: ovFetching } = useOverview(siteId, range)
  const { data: timeseries, isLoading: tsLoading, isFetching: tsFetching } = useTimeseries(siteId, range)
  const { data: rtData, connected, reconnecting } = useRealtime({ siteId })

  const statusColor = reconnecting
    ? 'var(--color-accent-amber)'
    : connected
      ? 'var(--color-accent-green)'
      : 'var(--color-text-muted)'

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          ภาพรวม
        </h1>

        <div className="flex items-center gap-2">
          <RefreshButton loading={ovFetching || tsFetching} />
          <DatePresets loading={ovFetching || tsFetching} />
        </div>
      </div>

      {/* KPI strip — 5 cards including realtime visitors */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 mb-5">
        {/* Active visitors (realtime) */}
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: statusColor, boxShadow: connected ? `0 0 6px ${statusColor}` : 'none' }}
            />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              ออนไลน์ตอนนี้
            </p>
          </div>
          <p
            className="text-3xl font-bold tabular-nums mb-2"
            style={{ color: 'var(--color-accent-green)', fontFamily: "'JetBrains Mono', monospace" }}
          >
            {rtData?.active_visitors ?? 0}
          </p>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            ใน 5 นาทีที่ผ่านมา
          </p>
        </div>

        <KPICard
          label="การเข้าชม"
          value={overview?.pageviews ?? null}
          changePercent={overview?.pageviews_change ?? null}
          loading={ovLoading}
        />
        <KPICard
          label="ผู้เข้าชมไม่ซ้ำ"
          value={overview?.unique_visitors ?? null}
          changePercent={overview?.visitors_change ?? null}
          loading={ovLoading}
        />
        <KPICard
          label="อยู่นานเฉลี่ย"
          value={overview?.avg_session_duration ?? null}
          format="duration"
          changePercent={overview?.duration_change ?? null}
          loading={ovLoading}
        />
        <KPICard
          label="เข้าแล้วออก"
          value={overview?.bounce_rate ?? null}
          format="percentage"
          suffix={overview?.bounce_count != null ? ` (${overview.bounce_count})` : undefined}
          changePercent={overview?.bounce_change ? -overview.bounce_change : null}
          loading={ovLoading}
        />
      </div>

      {/* Trend chart */}
      <div className="mb-5">
        <TrendChart
          data={timeseries ?? []}
          rangedays={PRESET_DAYS[preset]}
          loading={tsLoading}
        />
      </div>

      {/* Realtime: active pages + event stream */}
      {siteId && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Active pages */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              หน้าที่ใช้งานอยู่
            </h2>
            {rtData && rtData.active_pages.length > 0 ? (
              <div className="flex flex-col gap-2">
                {rtData.active_pages.map((pg) => {
                  const maxCount = rtData.active_pages[0]?.count ?? 1
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
              เหตุการณ์ล่าสุด
            </h2>
            {rtData && rtData.recent_events.length > 0 ? (
              <div className="flex flex-col gap-2" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {rtData.recent_events.map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm py-1.5 rounded-lg px-2"
                    style={{ background: i === 0 ? 'var(--color-bg-surface)' : 'transparent' }}
                  >
                    <span
                      className="flex-1 truncate"
                      style={{ color: 'var(--color-text-primary)' }}
                      title={ev.url}
                    >
                      {decodeURIComponent(ev.url.replace(/^https?:\/\/[^/]+/, '') || '/')}
                    </span>
                    <span
                      className="text-xs shrink-0 tabular-nums"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <TimeAgo timestamp={ev.timestamp} />
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-xs shrink-0"
                      style={{ background: 'var(--color-bg-surface)', color: 'var(--color-accent-blue)' }}
                    >
                      {ev.event_type === 'pageview' ? 'เข้าชม' : ev.event_type === 'scroll' ? 'เลื่อน' : ev.event_type === 'click' ? 'คลิก' : ev.event_type === 'session_end' ? 'ออก' : ev.event_type}
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
      )}
    </div>
  )
}
