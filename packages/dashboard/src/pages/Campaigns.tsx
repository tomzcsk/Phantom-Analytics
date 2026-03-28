import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from 'lucide-react'
import { useSite } from '../context/SiteContext'
import { useDateRange } from '../context/DateRangeContext'
import { useCampaigns } from '../hooks/useAnalytics'
import { DatePresets } from '../components/DatePresets'
import { RefreshButton } from '../components/RefreshButton'
import { ExportButton } from '../components/ExportButton'
import type { CampaignStat } from '@phantom/shared'

const CAMPAIGN_COLORS = ['#4F8EF7', '#36D963', '#9B6EFF', '#F7B84B', '#F75252']

function fmtDuration(s: number): string {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function ChangeIndicator({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: 'var(--color-accent-green)' }}>
        <TrendingUp size={12} />+{value}%
      </span>
    )
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: 'var(--color-accent-red)' }}>
        <TrendingDown size={12} />{value}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
      <Minus size={12} />0%
    </span>
  )
}

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
    >
      <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 tabular-nums">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>{p.name}:</span>
          <span className="font-semibold">{p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

export function Campaigns() {
  const { activeSite } = useSite()
  const { range } = useDateRange()
  const siteId = activeSite?.id ?? ''
  const { data, isLoading, isFetching } = useCampaigns(siteId, range)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)

  const campaigns = data?.campaigns ?? []
  const timeseries = data?.timeseries ?? []

  // Build chart data: pivot timeseries into { timestamp, campaign1: n, campaign2: n, ... }
  const topCampaigns = campaigns.slice(0, 5).map((c) => c.utm_campaign)
  const chartDataMap = new Map<string, Record<string, string | number>>()
  for (const pt of timeseries) {
    const ts = new Date(pt.timestamp).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    const row = chartDataMap.get(ts) ?? { timestamp: ts }
    row[pt.campaign] = pt.visitors
    chartDataMap.set(ts, row)
  }
  const chartData = Array.from(chartDataMap.values())

  // Selected campaign detail
  const detail: CampaignStat | undefined = selectedCampaign
    ? campaigns.find((c) => c.utm_campaign === selectedCampaign)
    : undefined

  // Export data
  const exportHeaders = ['Campaign', 'Source', 'Medium', 'ผู้เข้าชม', 'Pageviews', 'Bounce Rate', 'เวลาเฉลี่ย', 'Conversions', 'เปลี่ยนแปลง']
  const exportRows = campaigns.map((c) => [
    c.utm_campaign, c.utm_source ?? '—', c.utm_medium ?? '—',
    c.visitors, c.pageviews, `${Math.round(c.bounce_rate * 100)}%`,
    fmtDuration(c.avg_duration), c.conversions, `${c.visitors_change}%`,
  ])

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          รายงานแคมเปญ
        </h1>
        <div className="flex items-center gap-2">
          <ExportButton
            headers={exportHeaders}
            rows={exportRows}
            filename={`campaigns-${activeSite?.name ?? 'site'}-${range.from}_${range.to}`}
            disabled={isLoading || campaigns.length === 0}
          />
          <RefreshButton loading={isFetching} />
          <DatePresets loading={isFetching} />
        </div>
      </div>

      {/* Timeseries Chart */}
      {!isLoading && chartData.length > 0 && (
        <div
          className="rounded-xl p-5 mb-5"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            ผู้เข้าชมตามแคมเปญ (Top 5)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
              <XAxis dataKey="timestamp" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(v) => <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{String(v)}</span>}
              />
              {topCampaigns.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Campaign Detail Panel */}
      {detail && (
        <div
          className="rounded-xl p-5 mb-5"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-accent-blue)', borderWidth: 2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              <ArrowUpRight size={16} className="inline mr-1" style={{ color: 'var(--color-accent-blue)' }} />
              {detail.utm_campaign}
            </h2>
            <button
              onClick={() => setSelectedCampaign(null)}
              className="text-xs px-2 py-1 rounded-lg"
              style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
            >
              ปิด
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Source', value: detail.utm_source ?? '—' },
              { label: 'Medium', value: detail.utm_medium ?? '—' },
              { label: 'ผู้เข้าชม', value: detail.visitors.toLocaleString() },
              { label: 'Pageviews', value: detail.pageviews.toLocaleString() },
              { label: 'อัตราตีกลับ', value: `${Math.round(detail.bounce_rate * 100)}%` },
              { label: 'อยู่นานเฉลี่ย', value: fmtDuration(detail.avg_duration) },
              { label: 'Conversions', value: detail.conversions.toLocaleString() },
              { label: 'เปลี่ยนแปลง', value: '', node: <ChangeIndicator value={detail.visitors_change} /> },
            ].map((item) => (
              <div key={item.label} className="rounded-lg p-3" style={{ background: 'var(--color-bg-surface)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
                {item.node ?? (
                  <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{item.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign Table */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          แคมเปญทั้งหมด
        </h2>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse rounded h-10" style={{ background: 'var(--color-bg-surface)' }} />
            ))}
          </div>
        ) : campaigns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Campaign</th>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Source</th>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Medium</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>ผู้เข้าชม</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Pageviews</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Bounce</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>เวลา</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Conv.</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>เปลี่ยนแปลง</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.utm_campaign}
                    onClick={() => setSelectedCampaign(selectedCampaign === c.utm_campaign ? null : c.utm_campaign)}
                    className="transition-colors"
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      background: selectedCampaign === c.utm_campaign ? 'var(--color-bg-surface)' : 'transparent',
                    }}
                  >
                    <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-accent-blue)' }}>{c.utm_campaign}</td>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text-primary)' }}>{c.utm_source ?? '—'}</td>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text-primary)' }}>{c.utm_medium ?? '—'}</td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{c.visitors.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{c.pageviews.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{Math.round(c.bounce_rate * 100)}%</td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{fmtDuration(c.avg_duration)}</td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: 'var(--color-accent-green)' }}>{c.conversions.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right"><ChangeIndicator value={c.visitors_change} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
            ไม่มีข้อมูลแคมเปญในช่วงนี้ — ลองส่ง UTM parameters ในลิงก์ของคุณ
          </p>
        )}
      </div>
    </div>
  )
}
