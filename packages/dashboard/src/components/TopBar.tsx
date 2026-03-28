import { useState, useEffect } from 'react'
import { Clock, ChevronDown } from 'lucide-react'
import { useTimezone, TIMEZONES } from '../context/TimezoneContext'
import { FormModal } from './FormModal'
import { DateRangePicker } from './DateRangePicker'
import { FilterBar } from './FilterBar'

function formatTime(tz: string): string {
  return new Date().toLocaleString('th-TH', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function TopBar() {
  const { timezone, setTimezone } = useTimezone()
  const [now, setNow] = useState(() => formatTime(timezone.value))
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    setNow(formatTime(timezone.value))
    const id = setInterval(() => setNow(formatTime(timezone.value)), 1000)
    return () => clearInterval(id)
  }, [timezone])

  return (
    <>
      <div
        className="h-12 flex items-center justify-end gap-3 px-6 border-b shrink-0"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
      >
        <FilterBar />
        <div className="w-px h-5" style={{ background: 'var(--color-border)' }} />
        <DateRangePicker />
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <Clock size={13} style={{ color: 'var(--color-accent-blue)' }} />
          <span style={{ color: 'var(--color-text-primary)' }}>{now}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-accent-blue)' }}>
            {timezone.label.split(' ')[0]}
          </span>
          <ChevronDown size={12} style={{ color: 'var(--color-text-muted)' }} />
        </button>
      </div>

      <FormModal open={showPicker} title="เปลี่ยน Timezone" onClose={() => setShowPicker(false)} width="w-80">
        <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto">
          {TIMEZONES.map((tz) => (
            <button
              key={tz.value}
              onClick={() => { setTimezone(tz); setShowPicker(false) }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: timezone.value === tz.value ? 'var(--color-accent-blue)' : 'transparent',
                color: timezone.value === tz.value ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {tz.label}
            </button>
          ))}
        </div>
      </FormModal>
    </>
  )
}
