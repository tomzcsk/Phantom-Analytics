import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDateRange } from '../context/DateRangeContext'
import type { DatePreset } from '../context/DateRangeContext'

const PRESETS: { label: string; value: Exclude<DatePreset, 'custom'> }[] = [
  { label: 'วันนี้', value: '1d' },
  { label: '7 วัน', value: '7d' },
  { label: '30 วัน', value: '30d' },
  { label: '90 วัน', value: '90d' },
]

interface DatePresetsProps {
  loading?: boolean
}

export function DatePresets({ loading = false }: DatePresetsProps) {
  const { preset, setPreset } = useDateRange()
  const qc = useQueryClient()
  const [clicked, setClicked] = useState<DatePreset | null>(null)

  // Clear clicked state when loading finishes
  useEffect(() => {
    if (!loading) setClicked(null)
  }, [loading])

  function handleClick(value: Exclude<DatePreset, 'custom'>) {
    if (value === preset && !loading) return
    setClicked(value)
    setPreset(value)
    // Invalidate all analytics queries so isFetching becomes true
    void qc.invalidateQueries()
  }

  return (
    <div
      className="flex items-center gap-1 rounded-lg p-1"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      {PRESETS.map((p) => {
        const isActive = preset === p.value
        const showSpinner = clicked === p.value && loading
        return (
          <button
            key={p.value}
            onClick={() => handleClick(p.value)}
            className="relative px-3 py-1.5 rounded-md text-sm font-medium transition-all"
            style={{
              background: isActive ? 'var(--color-bg-surface)' : 'transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
          >
            <span
              className="transition-opacity duration-150"
              style={{ opacity: showSpinner ? 0 : 1 }}
            >
              {p.label}
            </span>
            {showSpinner && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span
                  className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: 'var(--color-accent-blue)', borderTopColor: 'transparent' }}
                />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
