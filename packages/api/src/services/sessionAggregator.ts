import { prisma } from '../db/client.js'

/**
 * Session aggregation pipeline (E7-F1)
 *
 * Runs every 60 seconds. Reads all events from the events table,
 * groups by (site_id, session_id), and upserts aggregated session
 * records into the sessions table.
 *
 * Session ends: when the last event is > 30 minutes ago.
 * Bounce: page_count == 1 AND duration < 30 seconds.
 *
 * Uses INSERT ... ON CONFLICT DO UPDATE (requires UNIQUE(site_id, session_id)).
 */

const AGGREGATE_INTERVAL_MS = 60_000

async function aggregate(): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO sessions (
      id, site_id, session_id,
      entry_page, exit_page, page_count,
      duration_seconds, is_bounce, started_at, ended_at
    )
    SELECT
      gen_random_uuid(),
      site_id,
      session_id,
      (ARRAY_AGG(url ORDER BY timestamp ASC))[1]   AS entry_page,
      (ARRAY_AGG(url ORDER BY timestamp DESC))[1]  AS exit_page,
      COUNT(*) FILTER (WHERE event_type = 'pageview')::INTEGER AS page_count,
      GREATEST(0,
        EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp)))::INTEGER
      ) AS duration_seconds,
      CASE
        WHEN COUNT(*) FILTER (WHERE event_type = 'pageview') <= 1
          AND EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) < 30
        THEN TRUE ELSE FALSE
      END AS is_bounce,
      MIN(timestamp) AS started_at,
      CASE
        WHEN NOW() - MAX(timestamp) > INTERVAL '30 minutes'
        THEN MAX(timestamp) ELSE NULL
      END AS ended_at
    FROM events
    GROUP BY site_id, session_id
    ON CONFLICT (site_id, session_id) DO UPDATE SET
      exit_page        = EXCLUDED.exit_page,
      page_count       = EXCLUDED.page_count,
      duration_seconds = EXCLUDED.duration_seconds,
      is_bounce        = EXCLUDED.is_bounce,
      ended_at         = EXCLUDED.ended_at
  `
}

export function startSessionAggregator(): void {
  // Initial run shortly after startup
  setTimeout(() => {
    aggregate().catch((err: unknown) => console.error('[session-agg] error:', err))
  }, 5_000)

  setInterval(() => {
    aggregate().catch((err: unknown) => console.error('[session-agg] error:', err))
  }, AGGREGATE_INTERVAL_MS)
}
