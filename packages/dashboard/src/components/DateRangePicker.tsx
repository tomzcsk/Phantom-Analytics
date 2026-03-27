import { useState, useRef, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useDateRange } from '../context/DateRangeContext'
import { format } from 'date-fns'

export function DateRangePicker() {
  const { range, preset, setCustomRange } = useDateRange()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)

  const isValid = from <= to && to <= today

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleApply() {
    if (!isValid) return
    setCustomRange(from, to)
    void qc.invalidateQueries()
    setOpen(false)
  }

  function handleToggle() {
    if (!open) {
      setFrom(range.from)
      setTo(range.to)
    }
    setOpen(!open)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors"
        style={{
          border: '1px solid var(--color-border)',
          color: preset === 'custom' ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
          background: preset === 'custom' ? 'var(--color-bg-surface)' : 'transparent',
        }}
      >
        <Calendar size={13} style={{ color: 'var(--color-accent-blue)' }} />
        {preset === 'custom' ? (
          <span style={{ color: 'var(--color-text-primary)' }}>{range.from} — {range.to}</span>
        ) : (
          <span>กำหนดเอง</span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-xl p-4 shadow-lg z-50 flex flex-col gap-3"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', minWidth: 280 }}
        >
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>จากวันที่</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                colorScheme: 'dark',
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>ถึงวันที่</label>
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                colorScheme: 'dark',
              }}
            />
          </div>
          {!isValid && from > to && (
            <p className="text-xs" style={{ color: 'var(--color-accent-red)' }}>
              วันเริ่มต้นต้องไม่เกินวันสิ้นสุด
            </p>
          )}
          <button
            onClick={handleApply}
            disabled={!isValid}
            className="w-full py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: isValid ? 'var(--color-accent-blue)' : 'var(--color-bg-surface)',
              color: isValid ? '#fff' : 'var(--color-text-muted)',
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            ใช้งาน
          </button>
        </div>
      )}
    </div>
  )
}
