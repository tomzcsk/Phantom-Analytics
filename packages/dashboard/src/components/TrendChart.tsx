import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  raw: string
}

function toChartData(data: TimeseriesPoint[], metric: Metric, rangedays: number): ChartPoint[] {
  return data.map((pt) => ({
    label: rangedays <= 2
      ? format(parseISO(pt.timestamp), 'HH:mm')
      : rangedays <= 90
        ? format(parseISO(pt.timestamp), 'MMM d')
        : format(parseISO(pt.timestamp), 'MMM d'),
    value: pt[metric],
    raw: pt.timestamp,
  }))
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0]
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
      <p className="font-semibold tabular-nums">{(item?.value ?? 0).toLocaleString()}</p>
    </div>
  )
}

interface TrendChartProps {
  data: TimeseriesPoint[]
  rangedays?: number
  loading?: boolean
}

export function TrendChart({ data, rangedays = 30, loading = false }: TrendChartProps) {
  const [metric, setMetric] = useState<Metric>('pageviews')
  const cfg = METRIC_CONFIG[metric]
  const chartData = toChartData(data, metric, rangedays)

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
      {/* Metric toggle pills */}
      <div className="flex items-center gap-2 mb-5">
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

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 4, left: -20, bottom: 0 }}>
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
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: cfg.color, strokeWidth: 1, strokeDasharray: '4 2' }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={cfg.color}
            fill={`url(#${cfg.gradientId})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: cfg.color, stroke: 'var(--color-bg-card)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
