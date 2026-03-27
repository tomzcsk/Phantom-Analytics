import { Redis } from 'ioredis'
import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import type { RealtimePayload, RealtimeEvent, ActivePage } from '@phantom/shared'
import type { EnrichedEvent } from '@phantom/shared'
import { siteChannel } from '../services/realtime.js'
import { prisma } from '../db/client.js'
import { requireAuth } from './auth.js'
import { canAccessSite } from '../services/siteAccess.js'

/**
 * GET /api/realtime/stream (E4-F7)
 *
 * Server-Sent Events endpoint for live analytics.
 *
 * Architecture:
 *   - Each SSE connection creates a dedicated Redis subscriber client
 *   - Events arrive via Redis Pub/Sub channel site_<id> (published by /api/collect)
 *   - In-memory state accumulates events; SSE payload is emitted every 2s
 *   - On client disconnect: subscriber is closed, interval cleared
 *
 * Per CLAUDE.md:
 *   - SSE is the ONLY real-time mechanism — no WebSocket, no long-polling
 *   - Use site_<site_id> channel names exclusively
 *   - Nginx proxy_read_timeout is set to 86400s for this endpoint
 */

const ACTIVE_WINDOW_MS = 5 * 60 * 1000  // 5 minutes
const RECENT_EVENTS_LIMIT = 50
const EMIT_INTERVAL_MS = 2_000

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

export const realtimeRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', requireAuth)

  fastify.addHook('preHandler', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>
    const siteId = query['site_id']
    if (siteId && !(await canAccessSite(request.user.sub, request.user.role, siteId))) {
      reply.code(403).send({ error: 'ไม่มีสิทธิ์เข้าถึงเว็บไซต์นี้' })
    }
  })

  const app = fastify.withTypeProvider<ZodTypeProvider>()

  const querySchema = z.object({
    site_id: z.string().uuid(),
  })

  app.get('/realtime/stream', { schema: { querystring: querySchema } }, async (request, reply) => {
    const { site_id } = request.query

    // ── In-memory realtime state ──────────────────────────────────────────
    // session_id → last seen timestamp (ms)
    const activeSessions = new Map<string, number>()
    // url → Set of session_ids currently on that page
    const pageSessionMap = new Map<string, Set<string>>()
    // Circular buffer of recent events (newest-first)
    const recentEvents: RealtimeEvent[] = []

    function updateState(event: EnrichedEvent): void {
      const now = Date.now()
      activeSessions.set(event.session_id, now)

      if (event.event_type === 'pageview') {
        if (!pageSessionMap.has(event.url)) {
          pageSessionMap.set(event.url, new Set())
        }
        pageSessionMap.get(event.url)!.add(event.session_id)
      }

      const realtimeEvent = {
        event_type: event.event_type,
        url: event.url,
        timestamp: event.timestamp,
        ...(event.country_code !== null && { country_code: event.country_code }),
        ...(event.device_type !== null && { device_type: event.device_type }),
      } as RealtimeEvent

      recentEvents.unshift(realtimeEvent)
      if (recentEvents.length > RECENT_EVENTS_LIMIT) {
        recentEvents.length = RECENT_EVENTS_LIMIT
      }
    }

    function buildPayload(): RealtimePayload {
      const now = Date.now()
      const cutoff = now - ACTIVE_WINDOW_MS

      // Prune stale sessions
      for (const [sid, ts] of activeSessions) {
        if (ts < cutoff) activeSessions.delete(sid)
      }

      // Count active visitors per page (only counting active sessions)
      const active = new Set(activeSessions.keys())
      const pages: ActivePage[] = []

      for (const [url, sessions] of pageSessionMap) {
        const count = [...sessions].filter((sid) => active.has(sid)).length
        if (count > 0) pages.push({ url, count })
        else pageSessionMap.delete(url)
      }

      pages.sort((a, b) => b.count - a.count)

      return {
        active_visitors: activeSessions.size,
        active_pages: pages,
        recent_events: recentEvents,
      }
    }

    // ── Seed from DB: load events from the last 5 minutes ─────────────────
    try {
      const cutoffDate = new Date(Date.now() - ACTIVE_WINDOW_MS)
      const recentDbEvents = await prisma.event.findMany({
        where: {
          site_id: site_id,
          timestamp: { gte: cutoffDate },
        },
        orderBy: { timestamp: 'desc' },
        take: RECENT_EVENTS_LIMIT,
        select: {
          session_id: true,
          event_type: true,
          url: true,
          timestamp: true,
          country_code: true,
          device_type: true,
        },
      })
      for (const ev of recentDbEvents) {
        const ts = new Date(ev.timestamp).getTime()
        activeSessions.set(ev.session_id, ts)

        if (ev.event_type === 'pageview') {
          if (!pageSessionMap.has(ev.url)) {
            pageSessionMap.set(ev.url, new Set())
          }
          pageSessionMap.get(ev.url)!.add(ev.session_id)
        }

        recentEvents.push({
          event_type: ev.event_type,
          url: ev.url,
          timestamp: new Date(ev.timestamp).toISOString(),
          ...(ev.country_code && { country_code: ev.country_code }),
          ...(ev.device_type && { device_type: ev.device_type }),
        } as RealtimeEvent)
      }
    } catch (err) {
      request.log.warn({ err }, '[realtime] seed from DB failed')
    }

    // ── Redis subscriber (dedicated connection per SSE client) ────────────
    const sub = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    })

    sub.on('error', (err: Error) => {
      request.log.warn({ err }, '[realtime] subscriber error')
    })

    await sub.connect()
    await sub.subscribe(siteChannel(site_id))

    sub.on('message', (_channel: string, message: string) => {
      try {
        const event = JSON.parse(message) as EnrichedEvent
        updateState(event)
      } catch {
        // Malformed message — ignore
      }
    })

    // ── SSE stream ────────────────────────────────────────────────────────
    let connected = true
    request.raw.on('close', () => {
      connected = false
    })

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering
    reply.raw.flushHeaders()

    async function* streamGenerator() {
      try {
        while (connected) {
          const payload = buildPayload()
          yield { data: JSON.stringify(payload) }
          await new Promise<void>((resolve) => setTimeout(resolve, EMIT_INTERVAL_MS))
        }
      } finally {
        sub.unsubscribe().catch(() => {})
        sub.quit().catch(() => {})
      }
    }

    return reply.sse(streamGenerator())
  })
}
