import { createContext, useContext, useState } from 'react'
import type { DateRange } from '@phantom/shared'
import { format, subDays } from 'date-fns'

export type DatePreset = '1d' | '7d' | '30d' | '90d'

const PRESET_DAYS: Record<DatePreset, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 }

function presetToRange(p: DatePreset): DateRange {
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
  setPreset: (p: DatePreset) => void
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null)

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPresetState] = useState<DatePreset>('30d')
  const [range, setRange] = useState<DateRange>(presetToRange('30d'))

  function setPreset(p: DatePreset) {
    setPresetState(p)
    setRange(presetToRange(p))
  }

  return (
    <DateRangeContext.Provider value={{ range, preset, setPreset }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider')
  return ctx
}
