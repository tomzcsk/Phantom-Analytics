/**
 * Analytics response types — what the API returns to the dashboard.
 * These are the data contracts between packages/api and packages/dashboard.
 */

/**
 * Date range for filtering analytics queries.
 */
export interface DateRange {
  from: string // ISO 8601 date string (YYYY-MM-DD)
  to: string // ISO 8601 date string (YYYY-MM-DD)
}

/**
 * Response from GET /api/analytics/overview
 * Returns 4 core KPIs plus period-over-period comparisons.
 */
export interface OverviewResponse {
  /** Total pageview events in the selected period. */
  pageviews: number

  /** Count of unique session fingerprints (anonymous unique visitors). */
  unique_visitors: number

  /** Mean session duration in seconds across all sessions in the period. */
  avg_session_duration: number

  /**
   * Bounce rate as a decimal (0.0–1.0).
   * A bounce = session with only 1 pageview and duration < 30s.
   */
  bounce_rate: number

  /** Number of sessions that bounced in the selected period. */
  bounce_count: number

  // ── Period-over-period deltas ──────────────────────────────────────────────
  // Positive = improvement, negative = decline. Values are percentages (e.g. 12.5 = +12.5%).

  /** % change in pageviews vs previous equivalent period. */
  pageviews_change: number

  /** % change in unique visitors vs previous equivalent period. */
  visitors_change: number

  /** % change in avg session duration vs previous equivalent period. */
  duration_change: number

  /** % change in bounce rate vs previous equivalent period (negative = improvement). */
  bounce_change: number
}

/**
 * A single time-bucketed data point for the trend chart.
 * Returned as an array from GET /api/analytics/timeseries.
 */
export interface TimeseriesPoint {
  /** ISO 8601 timestamp — the start of the time bucket. */
  timestamp: string

  /** Total pageview events in this bucket. */
  pageviews: number

  /** Unique session fingerprints in this bucket. */
  visitors: number

  /** Distinct sessions that started in this bucket. */
  sessions: number
}

/**
 * Metrics for a single page URL.
 * Returned in the array from GET /api/analytics/pages.
 */
export interface PageStat {
  /** The full path + query string of the page. */
  url: string

  /** Total pageviews for this URL in the period. */
  pageviews: number

  /** Unique visitor fingerprints who viewed this URL. */
  visitors: number

  /** Bounce rate for sessions that entered on this page (0.0–1.0). */
  bounce_rate: number

  /** Mean time_on_page in seconds for this URL. */
  avg_duration: number

  /**
   * 30-day daily pageview trend for the sparkline chart.
   * Always 30 data points — zero-filled for days with no data.
   */
  sparkline: number[]
}

/**
 * Traffic source category breakdown.
 * Returned in the array from GET /api/analytics/sources.
 */
export interface SourceStat {
  /** Classification of the traffic source based on referrer analysis. */
  source: 'direct' | 'organic' | 'referral' | 'social' | 'email' | 'paid'

  /** Absolute visitor count from this source in the period. */
  count: number

  /** Percentage of total traffic (0–100). */
  percentage: number
}

/**
 * Device type breakdown.
 * Returned in the array from GET /api/analytics/devices.
 */
export interface DeviceStat {
  /** Parsed device category from UA string. */
  device_type: 'desktop' | 'mobile' | 'tablet'

  /** Absolute session count on this device type. */
  count: number

  /** Percentage of total sessions (0–100). */
  percentage: number
}

/**
 * Geographic breakdown by country.
 * Returned in the array from GET /api/analytics/geo.
 */
export interface GeoStat {
  /** ISO 3166-1 alpha-2 country code. Used for flag display. */
  country_code: string

  /** Human-readable country name. */
  country_name: string

  /** Unique visitor count from this country. */
  visitors: number

  /** Percentage of total visitors (0–100). */
  percentage: number
}

/**
 * Timezone breakdown stat.
 * Returned from GET /api/analytics/timezones.
 */
export interface TimezoneStat {
  timezone: string
  visitors: number
  percentage: number
}

export interface RegionStat {
  region: string
  visitors: number
  percentage: number
}

/**
 * A single step definition in a funnel.
 * Steps are ordered by index (0-based).
 */
export interface FunnelStep {
  /** Zero-based position of this step in the funnel. */
  index: number

  /** Human-readable label for display in the funnel chart. */
  label: string

  /** Whether this step matches a page URL or a custom event name. */
  type: 'page_url' | 'event_name'

  /** The URL path to match (for page_url) or event name (for event_name). */
  value: string
}

/**
 * Funnel step enriched with conversion analytics.
 */
export interface FunnelStepResult extends FunnelStep {
  /** Number of sessions that reached this step. */
  entered: number

  /** Number of sessions that completed this step (reached the next step). */
  completed: number

  /**
   * Conversion rate from this step to the next (0.0–1.0).
   * For the final step, this equals completed/entered.
   */
  conversion_rate: number

  /**
   * Percentage of sessions that dropped off after this step (0.0–1.0).
   * drop_off_rate = 1 - conversion_rate
   */
  drop_off_rate: number
}

/**
 * Full funnel analysis result.
 * Returned from GET /api/analytics/funnel/:funnel_id
 */
export interface FunnelResult {
  /** UUID of the funnel definition. */
  funnel_id: string

  /** Human-readable funnel name. */
  name: string

  /** Ordered array of steps with conversion metrics. */
  steps: FunnelStepResult[]
}

/**
 * Browser usage breakdown.
 */
export interface BrowserStat {
  browser: string
  count: number
  percentage: number
}

/**
 * OS usage breakdown.
 */
export interface OSStat {
  os: string
  count: number
  percentage: number
}

/**
 * Full device analytics response from GET /api/analytics/devices.
 */
export interface DeviceAnalyticsResponse {
  devices: DeviceStat[]
  browsers: BrowserStat[]
  operating_systems: OSStat[]
}

/**
 * A specific referrer domain entry (top N referrers).
 */
export interface ReferrerDomain {
  domain: string
  count: number
  percentage: number
}

/**
 * Full sources analytics response from GET /api/analytics/sources.
 */
export interface SourcesAnalyticsResponse {
  sources: SourceStat[]
  top_referrers: ReferrerDomain[]
}

/**
 * Aggregated session record built from the events stream.
 * Returned from GET /api/sessions.
 */
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

/**
 * A single event within a session journey.
 * Returned from GET /api/sessions/:id/events.
 */
export interface SessionEvent {
  event_type: string
  url: string
  timestamp: string
}

/**
 * Scroll depth analytics for a single page URL.
 * Returned from GET /api/analytics/scroll-depth.
 */
export interface ScrollDepthStat {
  url: string
  avg_max_depth: number
  reached_25: number
  reached_50: number
  reached_75: number
  reached_100: number
  total_pageviews: number
}

/**
 * Click analytics for a tracked element.
 * Returned from GET /api/analytics/clicks.
 */
export interface ClickStat {
  element_id: string
  url: string
  click_count: number
  unique_clickers: number
}

/**
 * UTM parameter breakdown.
 * Returned from GET /api/analytics/sources/utm.
 */
export interface UtmStat {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  visitors: number
  percentage: number
}
