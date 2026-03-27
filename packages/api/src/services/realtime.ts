import { redis } from '../db/redis.js'

/**
 * Real-time SSE bridge service (E3-F7 publish side / E4-F7 subscribe side)
 *
 * Architecture:
 *   POST /api/collect → publishRealtimeEvent() → redis.publish(site_<id>, payload)
 *   GET  /api/realtime/stream → redisSub.subscribe(site_<id>) → SSE stream
 *
 * Per CLAUDE.md: always use channel name `site_<site_id>`. One subscriber
 * client per SSE connection, cleaned up on client disconnect.
 */

export const CHANNEL_PREFIX = 'site_'

/** Returns the Redis Pub/Sub channel name for a given site. */
export function siteChannel(siteId: string): string {
  return `${CHANNEL_PREFIX}${siteId}`
}

/**
 * Publish an event payload to the site's real-time channel.
 * Called immediately after pushToBuffer so SSE clients see events in < 100ms.
 * Never throws — a publish failure must not crash the collect endpoint.
 */
export async function publishRealtimeEvent(
  siteId: string,
  payload: unknown,
): Promise<void> {
  try {
    await redis.publish(siteChannel(siteId), JSON.stringify(payload))
  } catch (err) {
    console.error('[realtime] publish error:', err)
  }
}
