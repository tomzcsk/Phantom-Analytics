import { Prisma } from '@prisma/client'
import { redis } from '../db/redis.js'
import { prisma } from '../db/client.js'
import type { EnrichedEvent } from '@phantom/shared'

/**
 * Redis event buffer service (E3-F7)
 *
 * Architecture (CLAUDE.md):
 *   POST /api/collect → rpush to Redis List
 *   Background flush (every 1s): lrange + ltrim → prisma.event.createMany
 *
 * This keeps POST /api/collect under 50ms p99 regardless of DB write pressure.
 * The buffer survives temporary PostgreSQL unavailability — events stay in
 * the Redis List until the DB comes back.
 */

export const BUFFER_KEY = 'events_buffer'
export const FLUSH_INTERVAL_MS = 1_000
const BATCH_LIMIT = 1_000

/**
 * Serialize and append an enriched event to the Redis List buffer.
 * Called synchronously in the collect request handler (non-blocking).
 */
export async function pushToBuffer(event: EnrichedEvent): Promise<void> {
  await redis.rpush(BUFFER_KEY, JSON.stringify(event))
}

/**
 * Drain the Redis List into PostgreSQL via a single batch INSERT.
 * Uses LRANGE + LTRIM: safe for single-process Node.js (no concurrent flushers).
 */
async function flush(): Promise<void> {
  const count = await redis.llen(BUFFER_KEY)
  if (count === 0) return

  const batchSize = Math.min(count, BATCH_LIMIT)
  const raw = await redis.lrange(BUFFER_KEY, 0, batchSize - 1)
  await redis.ltrim(BUFFER_KEY, batchSize, -1)

  if (raw.length === 0) return

  const events = raw.map((s: string) => {
    const e = JSON.parse(s) as EnrichedEvent
    return {
      site_id: e.site_id,
      session_id: e.session_id,
      event_type: e.event_type,
      url: e.url,
      referrer: e.referrer ?? null,
      title: e.title ?? null,
      country_code: e.country_code,
      region: e.region,
      device_type: e.device_type,
      browser: e.browser,
      os: e.os,
      screen_width: e.screen_width ?? null,
      screen_height: e.screen_height ?? null,
      language: e.language ?? null,
      timezone: e.timezone ?? null,
      custom_name: e.custom_name ?? null,
      // Prisma nullable JSONB: cast to InputJsonValue; fall back to DbNull (SQL NULL)
      custom_properties:
        e.custom_properties !== undefined
          ? (e.custom_properties as Prisma.InputJsonValue)
          : Prisma.DbNull,
      time_on_page: e.time_on_page ?? null,
      timestamp: new Date(e.timestamp),
    }
  })

  await prisma.event.createMany({ data: events, skipDuplicates: true })
}

/**
 * Start the background flush loop.
 * Called once during server bootstrap — runs forever until process exits.
 */
export function startFlushLoop(): void {
  setInterval(() => {
    flush().catch((err: unknown) => {
      console.error('[buffer] flush error:', err)
    })
  }, FLUSH_INTERVAL_MS)
}
