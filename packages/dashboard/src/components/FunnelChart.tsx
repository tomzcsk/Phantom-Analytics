import type { FunnelResult } from '@phantom/shared'

interface FunnelChartProps {
  funnel: FunnelResult | null
  loading?: boolean
}

// Blue → amber gradient across steps
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

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <h3 className="text-sm font-semibold mb-5" style={{ color: 'var(--color-text-primary)' }}>
        {funnel.name}
      </h3>

      <div className="flex flex-col gap-3">
        {funnel.steps.map((step, i) => {
          const color = STEP_COLORS[i % STEP_COLORS.length] ?? '#4F8EF7'
          const widthPct = maxEntered > 0 ? (step.entered / maxEntered) * 100 : 0

          return (
            <div key={step.index}>
              {/* Step bar */}
              <div className="flex items-center gap-3 mb-1">
                <span
                  className="text-xs font-medium shrink-0"
                  style={{ color: 'var(--color-text-secondary)', width: 80, textAlign: 'right' }}
                  title={step.value}
                >
                  {step.label}
                </span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-surface)', height: 24 }}>
                  <div
                    className="h-full rounded-full flex items-center px-3 transition-all duration-500"
                    style={{ width: `${widthPct}%`, background: color, minWidth: 4 }}
                  >
                    {widthPct > 15 && (
                      <span className="text-xs font-semibold tabular-nums text-white">
                        {step.entered.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className="text-xs tabular-nums shrink-0"
                  style={{ color: 'var(--color-text-secondary)', width: 44, textAlign: 'right' }}
                >
                  {(step.conversion_rate * 100).toFixed(0)}%
                </span>
              </div>

              {/* Drop-off indicator between steps */}
              {i < funnel.steps.length - 1 && step.drop_off_rate > 0 && (
                <div className="flex items-center gap-3 mb-1">
                  <div style={{ width: 80 }} />
                  <p className="text-xs" style={{ color: 'var(--color-accent-red)', paddingLeft: 4 }}>
                    ↘ {(step.drop_off_rate * 100).toFixed(0)}% หลุดออก
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
