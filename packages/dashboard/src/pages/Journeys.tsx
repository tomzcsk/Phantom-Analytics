import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useSite } from '../context/SiteContext'
import { useDateRange } from '../context/DateRangeContext'
import { useSessions, useSessionEvents } from '../hooks/useAnalytics'
import type { SessionRecord } from '../hooks/useAnalytics'
import { DatePresets } from '../components/DatePresets'
import { RefreshButton } from '../components/RefreshButton'

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s}s`
}

function JourneyTimeline({ sessionId }: { sessionId: string }) {
  const { data: events, isLoading } = useSessionEvents(sessionId)

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 rounded flex-1" style={{ background: 'var(--color-bg-surface)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!events || events.length === 0) {
    return (
      <div className="p-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        ไม่พบเหตุการณ์สำหรับเซสชันนี้
      </div>
    )
  }

  return (
    <div className="p-4 overflow-x-auto">
      <div className="flex items-center gap-0 min-w-max">
        {events.map((ev, i) => {
          const path = decodeURIComponent(ev.url.replace(/^https?:\/\/[^/]+/, '') || '/')
          const isFirst = i === 0
          const isLast = i === events.length - 1
          const prevTs = i > 0 ? parseISO(events[i - 1]!.timestamp) : null
          const thisTs = parseISO(ev.timestamp)
          const elapsed = prevTs ? Math.round((thisTs.getTime() - prevTs.getTime()) / 1000) : null

          return (
            <div key={i} className="flex items-center gap-0">
              {elapsed !== null && (
                <div
                  className="flex items-center gap-1 px-2"
                  style={{ color: 'var(--color-text-muted)', fontSize: 11 }}
                >
                  <div className="h-px w-6" style={{ background: 'var(--color-border)' }} />
                  <span>{elapsed}s</span>
                  <div className="h-px w-6" style={{ background: 'var(--color-border)' }} />
                </div>
              )}
              <div
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs"
                style={{
                  background: isFirst
                    ? 'var(--color-accent-blue)22'
                    : isLast
                      ? 'var(--color-accent-amber)22'
                      : 'var(--color-bg-surface)',
                  border: `1px solid ${
                    isFirst
                      ? 'var(--color-accent-blue)55'
                      : isLast
                        ? 'var(--color-accent-amber)55'
                        : 'var(--color-border)'
                  }`,
                  minWidth: 80,
                  maxWidth: 140,
                }}
              >
                <span
                  className="font-medium truncate w-full text-center"
                  style={{
                    color: isFirst
                      ? 'var(--color-accent-blue)'
                      : isLast
                        ? 'var(--color-accent-amber)'
                        : 'var(--color-text-primary)',
                  }}
                  title={path}
                >
                  {path.length > 18 ? path.slice(0, 16) + '…' : path}
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
                  {ev.event_type}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SessionRow({
  session,
  isSelected,
  onClick,
}: {
  session: SessionRecord
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <>
      <tr
        onClick={onClick}
        style={{
          cursor: 'pointer',
          background: isSelected ? 'var(--color-bg-surface)' : 'transparent',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <td className="py-3 px-4 text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
          {session.session_id.slice(0, 12)}…
        </td>
        <td className="py-3 px-4 text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {decodeURIComponent(session.entry_page?.replace(/^https?:\/\/[^/]+/, '') || '/')}
        </td>
        <td className="py-3 px-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {decodeURIComponent(session.exit_page?.replace(/^https?:\/\/[^/]+/, '') || '—')}
        </td>
        <td className="py-3 px-4 text-sm tabular-nums text-right" style={{ color: 'var(--color-text-secondary)' }}>
          {session.page_count}
        </td>
        <td className="py-3 px-4 text-sm tabular-nums text-right" style={{ color: 'var(--color-text-secondary)' }}>
          {formatDuration(session.duration_seconds)}
        </td>
        <td className="py-3 px-4 text-center">
          {session.is_bounce ? (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-accent-red)22', color: 'var(--color-accent-red)' }}>เข้าแล้วออก</span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-accent-green)22', color: 'var(--color-accent-green)' }}>มีส่วนร่วม</span>
          )}
        </td>
        <td className="py-3 px-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {format(parseISO(session.started_at), 'MMM d, HH:mm')}
        </td>
      </tr>
      {isSelected && (
        <tr style={{ background: 'var(--color-bg-surface)' }}>
          <td colSpan={7} style={{ borderBottom: '1px solid var(--color-border)', padding: 0 }}>
            <JourneyTimeline sessionId={session.id} />
          </td>
        </tr>
      )}
    </>
  )
}

export function Journeys() {
  const { activeSite } = useSite()
  const { range } = useDateRange()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const siteId = activeSite?.id ?? ''

  const { data: sessions, isLoading, isFetching } = useSessions(siteId, range)

  // Reset page when date range changes
  const rangeKey = `${range.from}-${range.to}`
  const [prevRange, setPrevRange] = useState(rangeKey)
  if (rangeKey !== prevRange) { setPrevRange(rangeKey); setPage(0) }

  const thStyle = {
    color: 'var(--color-text-primary)',
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.02em',
    padding: '16px 16px',
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          เส้นทาง
        </h1>
        <div className="flex items-center gap-2">
          <RefreshButton loading={isFetching} />
          <DatePresets loading={isFetching} />
        </div>
      </div>

      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
        คลิกเซสชันใดก็ได้เพื่อดูเส้นทางการเข้าชม หน้าเข้าจะแสดงเป็นสี{' '}
        <span style={{ color: 'var(--color-accent-blue)' }}>น้ำเงิน</span> หน้าออกเป็นสี{' '}
        <span style={{ color: 'var(--color-accent-amber)' }}>เหลืองอำพัน</span>
      </p>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        {isLoading ? (
          <div className="animate-pulse p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded mb-2" style={{ background: 'var(--color-bg-surface)' }} />
            ))}
          </div>
        ) : (sessions ?? []).length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              ไม่พบเซสชันในช่วงนี้
              {' '}ระบบรวบรวมเซสชันทุกนาทีจากเหตุการณ์ที่เก็บได้
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '12%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={thStyle}>เซสชัน</th>
                  <th style={thStyle}>หน้าเข้า</th>
                  <th style={thStyle}>หน้าออก</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>จำนวนหน้า</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>ระยะเวลา</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>ประเภท</th>
                  <th style={thStyle}>เริ่มต้น</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const PAGE_SIZE = 20
                  const all = sessions ?? []
                  const totalPages = Math.ceil(all.length / PAGE_SIZE)
                  const slice = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                  return (
                    <>
                      {slice.map((session) => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          isSelected={selectedId === session.id}
                          onClick={() => setSelectedId((prev) => (prev === session.id ? null : session.id))}
                        />
                      ))}
                      {totalPages > 1 && (
                        <tr>
                          <td colSpan={7} style={{ borderTop: '1px solid var(--color-border)' }}>
                            <div className="flex items-center justify-between px-5 py-3">
                              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, all.length)} จาก {all.length}
                              </span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                                  disabled={page === 0}
                                  className="px-2 py-1 rounded text-xs"
                                  style={{
                                    background: 'var(--color-bg-surface)',
                                    color: page === 0 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                                    border: '1px solid var(--color-border)',
                                  }}
                                >
                                  ‹ ก่อนหน้า
                                </button>
                                <button
                                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                  disabled={page >= totalPages - 1}
                                  className="px-2 py-1 rounded text-xs"
                                  style={{
                                    background: 'var(--color-bg-surface)',
                                    color: page >= totalPages - 1 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                                    border: '1px solid var(--color-border)',
                                  }}
                                >
                                  ถัดไป ›
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
