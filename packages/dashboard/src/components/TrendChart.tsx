import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { TimeseriesPoint } from '@phantom/shared'

type Metric = 'pageviews' | 'visitors' | 'sessions'

const METRIC_CONFIG: Record<Metric, { label: string; color: string; gradientId: string }> = {
  pageviews: { label: 'การเข้าชม', color: '#4F8EF7', gradientId: 'gradPV' },
  visitors: { label: 'ผู้เข้าชม', color: '#36D9B0', gradientId: 'gradVIS' },
  sessions: { label: 'เซสชัน', color: '#9B6DFF', gradientId: 'gradSES' },
}

interface ChartPoint {
  label: string
  value: number
  prev?: number | undefined
  raw: string
}

function toChartData(data: TimeseriesPoint[], metric: Metric, rangedays: number, prevData?: TimeseriesPoint[]): ChartPoint[] {
  return data.map((pt, i) => ({
    label: rangedays <= 2
      ? format(parseISO(pt.timestamp), 'HH:mm')
      : format(parseISO(pt.timestamp), 'MMM d'),
    value: pt[metric],
    prev: prevData?.[i]?.[metric],
    raw: pt.timestamp,
  }))
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string }>
  label?: string
  showComparison?: boolean | undefined
}

function CustomTooltip({ active, payload, label, showComparison }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const current = payload.find((p) => p.dataKey === 'value')
  const prev = payload.find((p) => p.dataKey === 'prev')
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
    >
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 2 }}>{label}</p>
      <p className="font-semibold tabular-nums">{(current?.value ?? 0).toLocaleString()}</p>
      {showComparison && prev !== undefined && (
        <p className="tabular-nums" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
          ก่อนหน้า: {(prev?.value ?? 0).toLocaleString()}
        </p>
      )}
    </div>
  )
}

interface TrendChartProps {
  data: TimeseriesPoint[]
  comparisonData?: TimeseriesPoint[] | undefined
  rangedays?: number | undefined
  loading?: boolean | undefined
}

export function TrendChart({ data, comparisonData, rangedays = 30, loading = false }: TrendChartProps) {
  const [metric, setMetric] = useState<Metric>('pageviews')
  const [showComparison, setShowComparison] = useState(false)
  const cfg = METRIC_CONFIG[metric]
  const hasComparison = comparisonData && comparisonData.length > 0
  const chartData = toChartData(data, metric, rangedays, showComparison && hasComparison ? comparisonData : undefined)

  if (loading) {
    return (
      <div
        className="rounded-xl p-6 animate-pulse"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', height: 300 }}
      >
        <div className="h-full rounded" style={{ background: 'var(--color-bg-surface)' }} />
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      {/* Metric toggle pills + comparison toggle */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {(Object.entries(METRIC_CONFIG) as [Metric, typeof cfg][]).map(([key, c]) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: metric === key ? c.color + '22' : 'transparent',
                color: metric === key ? c.color : 'var(--color-text-secondary)',
                border: `1px solid ${metric === key ? c.color + '55' : 'var(--color-border)'}`,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        {hasComparison && (
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={{
              background: showComparison ? 'var(--color-accent-amber)22' : 'transparent',
              color: showComparison ? 'var(--color-accent-amber)' : 'var(--color-text-muted)',
              border: `1px solid ${showComparison ? 'var(--color-accent-amber)55' : 'var(--color-border)'}`,
            }}
          >
            เปรียบเทียบ
          </button>
        )}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={cfg.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={cfg.color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.5} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
          />
          <Tooltip content={<CustomTooltip showComparison={showComparison && hasComparison} />} cursor={{ stroke: cfg.color, strokeWidth: 1, strokeDasharray: '4 2' }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={cfg.color}
            fill={`url(#${cfg.gradientId})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: cfg.color, stroke: 'var(--color-bg-card)', strokeWidth: 2 }}
          />
          {showComparison && hasComparison && (
            <Line
              type="monotone"
              dataKey="prev"
              stroke={cfg.color}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              strokeOpacity={0.4}
              dot={false}
              activeDot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
