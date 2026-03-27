import { createContext, useContext, useState } from 'react'
import type { DateRange } from '@phantom/shared'
import { format, subDays } from 'date-fns'

export type DatePreset = '1d' | '7d' | '30d' | '90d' | 'custom'

const PRESET_DAYS: Record<Exclude<DatePreset, 'custom'>, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 }

function presetToRange(p: Exclude<DatePreset, 'custom'>): DateRange {
  const now = new Date()
  const days = PRESET_DAYS[p]
  return {
    from: format(subDays(now, days - 1), 'yyyy-MM-dd'),
    to: format(now, 'yyyy-MM-dd'),
  }
}

interface DateRangeContextValue {
  range: DateRange
  preset: DatePreset
  setPreset: (p: Exclude<DatePreset, 'custom'>) => void
  setCustomRange: (from: string, to: string) => void
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null)

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPresetState] = useState<DatePreset>('30d')
  const [range, setRange] = useState<DateRange>(presetToRange('30d'))

  function setPreset(p: Exclude<DatePreset, 'custom'>) {
    setPresetState(p)
    setRange(presetToRange(p))
  }

  function setCustomRange(from: string, to: string) {
    setPresetState('custom')
    setRange({ from, to })
  }

  return (
    <DateRangeContext.Provider value={{ range, preset, setPreset, setCustomRange }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider')
  return ctx
}
