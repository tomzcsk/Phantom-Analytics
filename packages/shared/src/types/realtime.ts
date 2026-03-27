/**
 * Real-time data types for the SSE stream.
 * These payloads are published via Redis Pub/Sub and streamed to the dashboard.
 */

/**
 * A page that has active visitors right now.
 * "Active" = session that sent a pageview in the last 5 minutes.
 */
export interface ActivePage {
  /** The URL path currently being viewed. */
  url: string

  /** Number of unique visitors currently on this page. */
  count: number
}

/**
 * A single event in the live event stream (last N events).
 * Contains only the non-PII fields needed for display.
 */
export interface RealtimeEvent {
  /** The type of event (pageview, event, funnel_step, etc.). */
  event_type: string

  /** The page URL where the event occurred. */
  url: string

  /** ISO 3166-1 alpha-2 country code (from GeoIP). */
  country_code?: string

  /** Parsed device type. */
  device_type?: string

  /** ISO 8601 timestamp when the event was received. */
  timestamp: string
}

/**
 * The payload sent over SSE every 2 seconds per site.
 * Subscribed to via GET /api/realtime/stream?site_id=<id>
 *
 * Redis channel: site_<site_id>
 */
export interface RealtimePayload {
  /** Number of unique session fingerprints active in the last 5 minutes. */
  active_visitors: number

  /** Pages currently being viewed, sorted by visitor count descending. */
  active_pages: ActivePage[]

  /**
   * Most recent events received for this site (capped at 50).
   * Ordered newest-first.
   */
  recent_events: RealtimeEvent[]
}

/**
 * Internal Redis message format published to site_<id> channels.
 * The SSE handler deserializes this and forwards it to connected clients.
 */
export interface RealtimeMessage {
  /** The site this event belongs to. */
  site_id: string

  /** ISO 8601 timestamp when the message was published. */
  published_at: string

  /** The full payload to send to SSE subscribers. */
  payload: RealtimePayload
}
