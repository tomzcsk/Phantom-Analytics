import { useSite } from '../context/SiteContext'
import { useDateRange } from '../context/DateRangeContext'
import { usePages } from '../hooks/useAnalytics'
import { TopPagesTable } from '../components/TopPagesTable'
import { DatePresets } from '../components/DatePresets'
import { RefreshButton } from '../components/RefreshButton'
import { ExportButton } from '../components/ExportButton'

export function Pages() {
  const { activeSite } = useSite()
  const { range } = useDateRange()
  const siteId = activeSite?.id ?? ''

  const { data: pages, isLoading, isFetching } = usePages(siteId, range)

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          หน้าเว็บ
        </h1>
        <div className="flex items-center gap-2">
          <ExportButton
            headers={['URL', 'การเข้าชม', 'ผู้เข้าชมไม่ซ้ำ', 'เข้าแล้วออก (%)', 'อยู่นานเฉลี่ย (วิ)']}
            rows={(pages ?? []).map((p) => [p.url, p.pageviews, p.visitors, (p.bounce_rate * 100).toFixed(1), p.avg_duration.toFixed(0)])}
            filename={`pages-${activeSite?.name ?? 'site'}-${range.from}_${range.to}`}
            disabled={isLoading || (pages ?? []).length === 0}
          />
          <RefreshButton loading={isFetching} />
          <DatePresets loading={isFetching} />
        </div>
      </div>

      <TopPagesTable pages={pages ?? []} loading={isLoading} />
    </div>
  )
}
