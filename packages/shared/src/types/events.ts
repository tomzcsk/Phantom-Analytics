/**
 * Event types that the tracker can emit and the API can receive.
 * This union drives schema validation on both ends.
 */
export type EventType = 'pageview' | 'event' | 'session_start' | 'session_end' | 'funnel_step' | 'scroll' | 'click'

/**
 * The canonical event payload sent from tracker.js → POST /api/collect.
 *
 * Privacy constraints:
 * - No raw IP addresses (stripped server-side)
 * - session_id is a non-reversible hash, not a user identifier
 * - No PII fields (no name, email, userId)
 */
export interface EventPayload {
  /** UUID of the registered site. Validated against sites table server-side. */
  site_id: string

  /**
   * Non-reversible fingerprint hash.
   * Derived from: screen resolution + UA + language + timezone.
   * No cookies or localStorage involved.
   */
  session_id: string

  /** The type of event being recorded. */
  event_type: EventType

  /** Full URL of the page where the event occurred. */
  url: string

  /** The HTTP Referer header or document.referrer value. */
  referrer?: string

  /** document.title at the time of the event. */
  title?: string

  /** Screen width in pixels (from screen.width). */
  screen_width?: number

  /** Screen height in pixels (from screen.height). */
  screen_height?: number

  /** Browser language (navigator.language). */
  language?: string

  /** IANA timezone identifier (Intl.DateTimeFormat().resolvedOptions().timeZone). */
  timezone?: string

  /** Time spent on the page in seconds (sent on session_end via sendBeacon). */
  time_on_page?: number

  /** For event_type='event' or 'funnel_step': the custom event name. */
  custom_name?: string

  /** Arbitrary metadata attached to custom events. Must be JSON-serializable. */
  custom_properties?: Record<string, unknown>

  /** UTM source parameter (e.g. 'google', 'newsletter'). Lowercase, trimmed. */
  utm_source?: string

  /** UTM medium parameter (e.g. 'cpc', 'email'). Lowercase, trimmed. */
  utm_medium?: string

  /** UTM campaign parameter (e.g. 'spring_sale'). Lowercase, trimmed. */
  utm_campaign?: string

  /** ISO 8601 timestamp of when the event occurred (client-side clock). */
  timestamp: string
}

/**
 * Enriched event — what gets persisted to the events hypertable after
 * server-side GeoIP lookup and UA parsing. Extends EventPayload with
 * server-derived fields.
 */
export interface EnrichedEvent extends EventPayload {
  /** ISO 3166-1 alpha-2 country code from GeoIP. Null if unresolvable. */
  country_code: string | null

  /** Region/state name from GeoIP. Null if unresolvable. */
  region: string | null

  /** Parsed device category. Null if UA is unrecognized. */
  device_type: 'desktop' | 'mobile' | 'tablet' | null

  /** Browser name (e.g. 'Chrome', 'Firefox', 'Safari'). */
  browser: string | null

  /** Operating system name (e.g. 'Windows', 'macOS', 'iOS', 'Android'). */
  os: string | null
}
