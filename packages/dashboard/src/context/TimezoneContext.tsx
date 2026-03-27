import { createContext, useContext, useState } from 'react'

export interface TimezoneOption {
  label: string
  value: string
  offset: number
}

export const TIMEZONES: TimezoneOption[] = [
  { label: 'UTC−12', value: 'Etc/GMT+12', offset: -12 },
  { label: 'UTC−11', value: 'Etc/GMT+11', offset: -11 },
  { label: 'UTC−10 (ฮาวาย)', value: 'Pacific/Honolulu', offset: -10 },
  { label: 'UTC−9 (อะแลสกา)', value: 'America/Anchorage', offset: -9 },
  { label: 'UTC−8 (แปซิฟิก)', value: 'America/Los_Angeles', offset: -8 },
  { label: 'UTC−7 (เมาน์เทน)', value: 'America/Denver', offset: -7 },
  { label: 'UTC−6 (เซ็นทรัล)', value: 'America/Chicago', offset: -6 },
  { label: 'UTC−5 (อีสเทิร์น)', value: 'America/New_York', offset: -5 },
  { label: 'UTC−3 (บราซิเลีย)', value: 'America/Sao_Paulo', offset: -3 },
  { label: 'UTC+0 (ลอนดอน)', value: 'Europe/London', offset: 0 },
  { label: 'UTC+1 (ปารีส)', value: 'Europe/Paris', offset: 1 },
  { label: 'UTC+2 (ไคโร)', value: 'Africa/Cairo', offset: 2 },
  { label: 'UTC+3 (มอสโก)', value: 'Europe/Moscow', offset: 3 },
  { label: 'UTC+4 (ดูไบ)', value: 'Asia/Dubai', offset: 4 },
  { label: 'UTC+5 (การาจี)', value: 'Asia/Karachi', offset: 5 },
  { label: 'UTC+5:30 (มุมไบ)', value: 'Asia/Kolkata', offset: 5.5 },
  { label: 'UTC+6 (ธากา)', value: 'Asia/Dhaka', offset: 6 },
  { label: 'UTC+7 (กรุงเทพฯ)', value: 'Asia/Bangkok', offset: 7 },
  { label: 'UTC+8 (สิงคโปร์)', value: 'Asia/Singapore', offset: 8 },
  { label: 'UTC+9 (โตเกียว)', value: 'Asia/Tokyo', offset: 9 },
  { label: 'UTC+10 (ซิดนีย์)', value: 'Australia/Sydney', offset: 10 },
  { label: 'UTC+12 (โอ๊คแลนด์)', value: 'Pacific/Auckland', offset: 12 },
]

const DEFAULT_TZ = TIMEZONES.find((t) => t.value === 'Asia/Bangkok')!

interface TimezoneContextValue {
  timezone: TimezoneOption
  setTimezone: (tz: TimezoneOption) => void
}

const TimezoneContext = createContext<TimezoneContextValue | null>(null)

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [timezone, setTimezone] = useState<TimezoneOption>(() => {
    const saved = localStorage.getItem('phantom_tz')
    if (saved) {
      const found = TIMEZONES.find((t) => t.value === saved)
      if (found) return found
    }
    return DEFAULT_TZ
  })

  function handleSet(tz: TimezoneOption) {
    setTimezone(tz)
    localStorage.setItem('phantom_tz', tz.value)
  }

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone: handleSet }}>
      {children}
    </TimezoneContext.Provider>
  )
}

export function useTimezone() {
  const ctx = useContext(TimezoneContext)
  if (!ctx) throw new Error('useTimezone must be used within TimezoneProvider')
  return ctx
}
