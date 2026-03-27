import { useState } from 'react'
import { useSite } from '../context/SiteContext'
import { useDateRange } from '../context/DateRangeContext'
import { usePages, useEntryExitPages } from '../hooks/useAnalytics'
import type { EntryExitStat } from '@phantom/shared'
import { TopPagesTable } from '../components/TopPagesTable'
import { DatePresets } from '../components/DatePresets'
import { RefreshButton } from '../components/RefreshButton'
import { ExportButton } from '../components/ExportButton'

type Tab = 'pages' | 'entry' | 'exit'

function EntryExitTable({ data, loading, label }: { data: EntryExitStat[]; loading: boolean; label: string }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse rounded h-10" style={{ background: 'var(--color-bg-surface)' }} />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl p-10 text-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>ไม่มีข้อมูล{label}ในช่วงนี้</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <th className="text-left py-3 px-5 font-medium" style={{ color: 'var(--color-text-muted)' }}>URL</th>
            <th className="text-right py-3 px-5 font-medium" style={{ color: 'var(--color-text-muted)' }}>เซสชัน</th>
            <th className="text-right py-3 px-5 font-medium" style={{ color: 'var(--color-text-muted)' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const max = data[0]?.sessions ?? 1
            const barPct = Math.max(4, (row.sessions / max) * 100)
            return (
              <tr key={row.url} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="py-3 px-5">
                  <div className="mb-1">
                    <span className="truncate block" style={{ color: 'var(--color-text-primary)', maxWidth: 500 }} title={row.url}>
                      {decodeURIComponent(row.url.replace(/^https?:\/\/[^/]+/, '') || '/')}
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ background: 'var(--color-bg-surface)', height: 4 }}>
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: 'var(--color-accent-blue)' }} />
                  </div>
                </td>
                <td className="py-3 px-5 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  {row.sessions.toLocaleString()}
                </td>
                <td className="py-3 px-5 text-right tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                  {row.percentage.toFixed(1)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Pages() {
  const { activeSite } = useSite()
  const { range } = useDateRange()
  const [tab, setTab] = useState<Tab>('pages')
  const siteId = activeSite?.id ?? ''

  const { data: pages, isLoading: pagesLoading, isFetching: pagesFetching } = usePages(siteId, range)
  const { data: entryExit, isLoading: eeLoading, isFetching: eeFetching } = useEntryExitPages(siteId, range)

  const isFetching = pagesFetching || eeFetching

  function getExportData() {
    if (tab === 'pages') {
      return {
        headers: ['URL', 'การเข้าชม', 'ผู้เข้าชมไม่ซ้ำ', 'เข้าแล้วออก (%)', 'อยู่นานเฉลี่ย (วิ)'],
        rows: (pages ?? []).map((p) => [p.url, p.pageviews, p.visitors, (p.bounce_rate * 100).toFixed(1), p.avg_duration.toFixed(0)]),
        filename: `pages-${activeSite?.name ?? 'site'}-${range.from}_${range.to}`,
        disabled: pagesLoading || (pages ?? []).length === 0,
      }
    }
    const data = tab === 'entry' ? (entryExit?.entry_pages ?? []) : (entryExit?.exit_pages ?? [])
    return {
      headers: ['URL', 'เซสชัน', '%'],
      rows: data.map((d) => [d.url, d.sessions, d.percentage.toFixed(1)]),
      filename: `${tab === 'entry' ? 'landing' : 'exit'}-pages-${activeSite?.name ?? 'site'}-${range.from}_${range.to}`,
      disabled: eeLoading || data.length === 0,
    }
  }

  const exportData = getExportData()

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            หน้าเว็บ
          </h1>
          <div
            className="flex items-center gap-1 rounded-lg p-1"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            {([
              { key: 'pages' as Tab, label: 'ยอดนิยม' },
              { key: 'entry' as Tab, label: 'หน้าเข้า' },
              { key: 'exit' as Tab, label: 'หน้าออก' },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-3 py-1 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: tab === t.key ? 'var(--color-bg-surface)' : 'transparent',
                  color: tab === t.key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            headers={exportData.headers}
            rows={exportData.rows}
            filename={exportData.filename}
            disabled={exportData.disabled}
          />
          <RefreshButton loading={isFetching} />
          <DatePresets loading={isFetching} />
        </div>
      </div>

      {tab === 'pages' && <TopPagesTable pages={pages ?? []} loading={pagesLoading} />}
      {tab === 'entry' && <EntryExitTable data={entryExit?.entry_pages ?? []} loading={eeLoading} label="หน้าเข้า" />}
      {tab === 'exit' && <EntryExitTable data={entryExit?.exit_pages ?? []} loading={eeLoading} label="หน้าออก" />}
    </div>
  )
}
