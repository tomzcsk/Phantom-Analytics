import type { FunnelResult } from '@phantom/shared'

interface FunnelChartProps {
  funnel: FunnelResult | null
  loading?: boolean
}

const STEP_COLORS = ['#4F8EF7', '#6B7FFF', '#9B6EFF', '#D46EFF', '#F7B84B']

export function FunnelChart({ funnel, loading = false }: FunnelChartProps) {
  if (loading) {
    return (
      <div
        className="rounded-xl animate-pulse"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', height: 280 }}
      />
    )
  }

  if (!funnel || funnel.steps.length === 0) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
          ไม่มีข้อมูลช่องทาง
        </p>
      </div>
    )
  }

  const maxEntered = funnel.steps[0]?.entered ?? 1
  const totalSteps = funnel.steps.length

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {funnel.name}
        </h3>
        {maxEntered > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              เข้า {funnel.steps[0]?.entered.toLocaleString()}
            </span>
            <span className="text-xs font-semibold" style={{ color: 'var(--color-accent-green)' }}>
              สำเร็จ {funnel.steps[totalSteps - 1]?.entered.toLocaleString()} ({maxEntered > 0 ? ((funnel.steps[totalSteps - 1]?.entered ?? 0) / maxEntered * 100).toFixed(1) : 0}%)
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0">
        {funnel.steps.map((step, i) => {
          const color = STEP_COLORS[i % STEP_COLORS.length] ?? '#4F8EF7'
          const widthPct = maxEntered > 0 ? Math.max(8, (step.entered / maxEntered) * 100) : 0
          const nextStep = i < totalSteps - 1 ? funnel.steps[i + 1] : null
          const dropOff = nextStep ? step.entered - nextStep.entered : 0

          return (
            <div key={step.index}>
              {/* Step row */}
              <div className="flex items-center gap-4">
                {/* Step number */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
                  style={{ background: color, color: '#fff' }}
                >
                  {i + 1}
                </div>

                {/* Funnel bar — width proportional to entered count */}
                <div className="flex-1">
                  <div
                    className="rounded-lg flex items-center justify-between px-4 transition-all duration-500"
                    style={{
                      width: `${widthPct}%`,
                      background: `${color}20`,
                      border: `1px solid ${color}40`,
                      height: 44,
                    }}
                  >
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {step.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums shrink-0 ml-3" style={{ color }}>
                      {step.entered.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Conversion rate */}
                <span
                  className="text-sm font-semibold tabular-nums shrink-0"
                  style={{ color: 'var(--color-text-secondary)', width: 48, textAlign: 'right' }}
                >
                  {(step.conversion_rate * 100).toFixed(0)}%
                </span>
              </div>

              {/* Drop-off connector between steps */}
              {i < totalSteps - 1 && (
                <div className="flex items-center gap-4 py-1">
                  <div className="w-7 flex justify-center shrink-0">
                    <div style={{ width: 2, height: 20, background: 'var(--color-border)' }} />
                  </div>
                  {dropOff > 0 && (
                    <p className="text-xs" style={{ color: 'var(--color-accent-red)' }}>
                      ↓ -{dropOff.toLocaleString()} ({(step.drop_off_rate * 100).toFixed(0)}% หลุดออก)
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
