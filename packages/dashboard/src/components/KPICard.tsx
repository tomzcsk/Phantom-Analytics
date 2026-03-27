import { useEffect, useRef, useState } from 'react'

interface KPICardProps {
  label: string
  value: number | null
  format?: 'number' | 'duration' | 'percentage'
  suffix?: string | undefined
  changePercent?: number | null
  loading?: boolean
}

function formatValue(value: number, fmt: 'number' | 'duration' | 'percentage'): string {
  if (fmt === 'duration') {
    const m = Math.floor(value / 60)
    const s = Math.round(value % 60)
    return `${m}m ${s.toString().padStart(2, '0')}s`
  }
  if (fmt === 'percentage') return `${(value * 100).toFixed(1)}%`
  return value.toLocaleString()
}

function useCountUp(target: number | null, duration = 700): number | null {
  const [current, setCurrent] = useState<number | null>(null)
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    if (target === null) return

    fromRef.current = current ?? 0
    startRef.current = null

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(fromRef.current + ((target ?? 0) - fromRef.current) * eased))
      if (progress < 1) frameRef.current = requestAnimationFrame(step)
    }

    frameRef.current = requestAnimationFrame(step)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration]) // eslint-disable-line react-hooks/exhaustive-deps

  return current
}

export function KPICard({ label, value, format = 'number', suffix, changePercent, loading = false }: KPICardProps) {
  const animatedValue = useCountUp(value)

  if (loading) {
    return (
      <div
        className="rounded-xl p-6 animate-pulse"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <div className="h-4 rounded mb-4" style={{ background: 'var(--color-bg-surface)', width: '40%' }} />
        <div className="h-8 rounded mb-3" style={{ background: 'var(--color-bg-surface)', width: '60%' }} />
        <div className="h-3 rounded" style={{ background: 'var(--color-bg-surface)', width: '50%' }} />
      </div>
    )
  }

  const trend =
    changePercent === null || changePercent === undefined
      ? 'flat'
      : changePercent > 0
        ? 'up'
        : changePercent < 0
          ? 'down'
          : 'flat'

  const trendColor =
    trend === 'up'
      ? 'var(--color-accent-green)'
      : trend === 'down'
        ? 'var(--color-accent-red)'
        : 'var(--color-text-muted)'

  const displayValue =
    animatedValue !== null ? formatValue(animatedValue, format) : '—'

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
      <p
        className="text-3xl font-bold mb-2 tabular-nums"
        style={{ color: 'var(--color-text-primary)', fontFamily: "'JetBrains Mono', monospace" }}
      >
        {displayValue}{suffix && <span className="text-lg font-semibold" style={{ color: 'var(--color-text-muted)' }}>{suffix}</span>}
      </p>
      {changePercent !== null && changePercent !== undefined && (
        <p className="text-xs font-medium" style={{ color: trendColor }}>
          {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}{' '}
          {changePercent > 0 ? '+' : ''}
          {changePercent.toFixed(1)}% เทียบช่วงก่อนหน้า
        </p>
      )}
    </div>
  )
}
