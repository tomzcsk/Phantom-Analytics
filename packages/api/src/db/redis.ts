import { Redis } from 'ioredis'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

const sharedOptions = {
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
} as const

/** General-purpose Redis client for commands (GET, SET, RPUSH, PUBLISH, etc.) */
export const redis = new Redis(REDIS_URL, sharedOptions)

/**
 * Dedicated subscriber client.
 * Redis pub/sub mode locks a connection — it cannot issue regular commands.
 * E4-F7 (SSE) uses this to subscribe to site_<id> channels.
 */
export const redisSub = new Redis(REDIS_URL, {
  ...sharedOptions,
  maxRetriesPerRequest: null, // reconnect indefinitely for long-lived subscriptions
})

redis.on('error', (err: Error) => console.error('[redis] error:', err.message))
redisSub.on('error', (err: Error) => console.error('[redis:sub] error:', err.message))
