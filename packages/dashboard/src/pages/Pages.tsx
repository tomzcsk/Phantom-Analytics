import { useSite } from '../context/SiteContext'
import { useDateRange } from '../context/DateRangeContext'
import { usePages } from '../hooks/useAnalytics'
import { TopPagesTable } from '../components/TopPagesTable'
import { DatePresets } from '../components/DatePresets'
import { RefreshButton } from '../components/RefreshButton'

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
          <RefreshButton loading={isFetching} />
          <DatePresets loading={isFetching} />
        </div>
      </div>

      <TopPagesTable pages={pages ?? []} loading={isLoading} />
    </div>
  )
}
