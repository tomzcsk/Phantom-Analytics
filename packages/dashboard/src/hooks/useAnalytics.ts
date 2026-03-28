import { useQuery } from '@tanstack/react-query'
import type {
  DateRange,
  OverviewResponse,
  TimeseriesPoint,
  TimeseriesResponse,
  PageStat,
  SourcesAnalyticsResponse,
  DeviceAnalyticsResponse,
  GeoStat,
  FunnelResult,
  ScrollDepthStat,
  ClickStat,
  TimezoneStat,
  RegionStat,
  UtmStat,
  EntryExitPagesResponse,
} from '@phantom/shared'
import { apiGet } from '../lib/api'
import { useTimezone } from '../context/TimezoneContext'
import { useFilter } from '../context/FilterContext'

function rangeParams(siteId: string, range: DateRange, tz: string, filterParams = ''): string {
  return `site_id=${encodeURIComponent(siteId)}&from=${range.from}&to=${range.to}&tz=${encodeURIComponent(tz)}${filterParams}`
}

export function useOverview(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  const { filterParams, filters } = useFilter()
  return useQuery({
    queryKey: ['overview', siteId, range, timezone.value, filters],
    queryFn: () => apiGet<OverviewResponse>(`/analytics/overview?${rangeParams(siteId, range, timezone.value, filterParams)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId),
  })
}

export function useTimeseries(siteId: string, range: DateRange, compare = false) {
  const { timezone } = useTimezone()
  const { filterParams, filters } = useFilter()
  return useQuery({
    queryKey: ['timeseries', siteId, range, timezone.value, compare, filters],
    queryFn: () => {
      const base = rangeParams(siteId, range, timezone.value, filterParams)
      if (compare) {
        return apiGet<TimeseriesResponse>(`/analytics/timeseries?${base}&compare=true`)
      }
      return apiGet<TimeseriesPoint[]>(`/analytics/timeseries?${base}`).then(
        (current) => ({ current }) as TimeseriesResponse,
      )
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId),
  })
}

export function useEntryExitPages(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  const { filterParams, filters } = useFilter()
  return useQuery({
    queryKey: ['entry-exit-pages', siteId, range, timezone.value, filters],
    queryFn: () => apiGet<EntryExitPagesResponse>(`/analytics/entry-exit-pages?${rangeParams(siteId, range, timezone.value, filterParams)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId),
  })
}

export function usePages(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  const { filterParams, filters } = useFilter()
  return useQuery({
    queryKey: ['pages', siteId, range, timezone.value, filters],
    queryFn: () => apiGet<PageStat[]>(`/analytics/pages?${rangeParams(siteId, range, timezone.value, filterParams)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId),
  })
}

export function useSources(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  const { filterParams, filters } = useFilter()
  return useQuery({
    queryKey: ['sources', siteId, range, timezone.value, filters],
    queryFn: () =>
      apiGet<SourcesAnalyticsResponse>(`/analytics/sources?${rangeParams(siteId, range, timezone.value, filterParams)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId),
  })
}

export function useDevices(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  const { filterParams, filters } = useFilter()
  return useQuery({
    queryKey: ['devices', siteId, range, timezone.value, filters],
    queryFn: () =>
      apiGet<DeviceAnalyticsResponse>(`/analytics/devices?${rangeParams(siteId, range, timezone.value, filterParams)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId),
  })
}

export function useGeo(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  const { filterParams, filters } = useFilter()
  return useQuery({
    queryKey: ['geo', siteId, range, timezone.value, filters],
    queryFn: () => apiGet<GeoStat[]>(`/analytics/geo?${rangeParams(siteId, range, timezone.value, filterParams)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId),
  })
}

export function useTimezones(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  const { filterParams, filters } = useFilter()
  return useQuery({
    queryKey: ['timezones', siteId, range, timezone.value, filters],
    queryFn: () => apiGet<TimezoneStat[]>(`/analytics/timezones?${rangeParams(siteId, range, timezone.value, filterParams)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId),
  })
}

export function useRegions(siteId: string, range: DateRange, countryCode: string) {
  const { timezone } = useTimezone()
  return useQuery({
    queryKey: ['regions', siteId, range, timezone.value, countryCode],
    queryFn: () => apiGet<RegionStat[]>(`/analytics/regions?${rangeParams(siteId, range, timezone.value)}&country_code=${encodeURIComponent(countryCode)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId) && Boolean(countryCode),
  })
}

export function useUtmSources(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  const { filterParams, filters } = useFilter()
  return useQuery({
    queryKey: ['utm-sources', siteId, range, timezone.value, filters],
    queryFn: () =>
      apiGet<UtmStat[]>(`/analytics/sources/utm?${rangeParams(siteId, range, timezone.value, filterParams)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId),
  })
}

export function useFunnel(funnelId: string, siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  return useQuery({
    queryKey: ['funnel', funnelId, siteId, range, timezone.value],
    queryFn: () =>
      apiGet<FunnelResult>(
        `/analytics/funnel/${encodeURIComponent(funnelId)}?${rangeParams(siteId, range, timezone.value)}`,
      ),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: Boolean(funnelId) && Boolean(siteId),
  })
}

export interface SessionRecord {
  id: string
  session_id: string
  entry_page: string | null
  exit_page: string | null
  page_count: number
  duration_seconds: number
  is_bounce: boolean
  started_at: string
  ended_at: string | null
}

export interface SessionEvent {
  event_type: string
  url: string
  timestamp: string
}

export interface FunnelDef {
  id: string
  name: string
  steps: import('@phantom/shared').FunnelStep[]
  created_at: string
}

export function useSessions(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  return useQuery({
    queryKey: ['sessions', siteId, range, timezone.value],
    queryFn: () =>
      apiGet<SessionRecord[]>(`/sessions?${rangeParams(siteId, range, timezone.value)}&limit=100`),
    staleTime: 60_000,
    enabled: Boolean(siteId),
  })
}

export function useSessionEvents(sessionId: string) {
  return useQuery({
    queryKey: ['session-events', sessionId],
    queryFn: () => apiGet<SessionEvent[]>(`/sessions/${encodeURIComponent(sessionId)}/events`),
    staleTime: 300_000,
    enabled: Boolean(sessionId),
  })
}

export function useScrollDepth(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  const { filterParams, filters } = useFilter()
  return useQuery({
    queryKey: ['scroll-depth', siteId, range, timezone.value, filters],
    queryFn: () => apiGet<ScrollDepthStat[]>(`/analytics/scroll-depth?${rangeParams(siteId, range, timezone.value, filterParams)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId),
  })
}

export function useClicks(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  const { filterParams, filters } = useFilter()
  return useQuery({
    queryKey: ['clicks', siteId, range, timezone.value, filters],
    queryFn: () => apiGet<ClickStat[]>(`/analytics/clicks?${rangeParams(siteId, range, timezone.value, filterParams)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(siteId),
  })
}

export interface ClickVariable {
  id: string
  site_id: string
  key: string
  name: string
  created_at: string
}

export function useClickVariables(siteId: string) {
  return useQuery({
    queryKey: ['click-variables', siteId],
    queryFn: () => apiGet<ClickVariable[]>(`/click-variables?site_id=${encodeURIComponent(siteId)}`),
    staleTime: 30_000,
    enabled: Boolean(siteId),
  })
}

export function useFunnels(siteId: string) {
  return useQuery({
    queryKey: ['funnels', siteId],
    queryFn: () => apiGet<FunnelDef[]>(`/funnels?site_id=${encodeURIComponent(siteId)}`),
    staleTime: 60_000,
    enabled: Boolean(siteId),
  })
}
