import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import type { OverviewResponse, TimeseriesPoint } from '@phantom/shared'
import { KPICard } from '../components/KPICard'
import { TrendChart } from '../components/TrendChart'

interface PublicData {
  site: { name: string; domain: string }
  overview: OverviewResponse
  timeseries: TimeseriesPoint[]
  range: { from: string; to: string }
}

export function PublicDashboard() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setError('ไม่พบ token'); setLoading(false); return }

    fetch(`/api/public/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
        }
        return res.json() as Promise<PublicData>
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--color-bg-base)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-accent-blue)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--color-bg-base)' }}>
        <div className="rounded-xl p-8 text-center max-w-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            {error === 'ลิงก์หมดอายุแล้ว' ? 'ลิงก์หมดอายุ' : 'ไม่สามารถเข้าถึงได้'}
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { site, overview, timeseries } = data

  return (
    <div style={{ background: 'var(--color-bg-base)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{site.name}</h1>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{site.domain} — 30 วันล่าสุด</p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--color-accent-blue)22', color: 'var(--color-accent-blue)' }}>
            Phantom Analytics
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-screen-xl mx-auto">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-5">
          <KPICard label="การเข้าชม" value={overview.pageviews} changePercent={overview.pageviews_change} />
          <KPICard label="ผู้เข้าชมไม่ซ้ำ" value={overview.unique_visitors} changePercent={overview.visitors_change} />
          <KPICard label="อยู่นานเฉลี่ย" value={overview.avg_session_duration} format="duration" changePercent={overview.duration_change} />
          <KPICard label="เข้าแล้วออก" value={overview.bounce_rate} format="percentage" changePercent={overview.bounce_change ? -overview.bounce_change : null} />
        </div>

        {/* Trend chart */}
        <TrendChart data={timeseries} rangedays={30} />
      </div>
    </div>
  )
}
