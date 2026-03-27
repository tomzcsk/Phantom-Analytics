import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import type { EnrichedEvent } from '@phantom/shared'

import { prisma } from '../db/client.js'
import { lookupGeo } from '../services/geo.js'
import { parseUA } from '../services/ua.js'
import { pushToBuffer } from '../services/buffer.js'
import { publishRealtimeEvent } from '../services/realtime.js'

/**
 * POST /api/collect (E3-F2)
 *
 * Main event ingestion endpoint. Per CLAUDE.md pattern:
 *   1. Validate (Zod + site_id existence check)
 *   2. Enrich  (GeoIP + UA parsing)
 *   3. Filter  (bot detection — silent 200, not stored)
 *   4. Buffer  (Redis List push)
 *   5. Publish (Redis Pub/Sub → SSE clients)
 *   → 202 Accepted
 *
 * Response is intentionally fast: enrichment is synchronous/local,
 * DB write is deferred to the background flush loop (E3-F7).
 */

const collectBodySchema = z.object({
  /** UUID of the registered site */
  site_id: z.string().uuid({ message: 'site_id must be a valid UUID' }),

  /**
   * E9-F2: Cryptographically random tracking token (32 bytes as 64-char hex).
   * Validated against the sites table to prevent spoofed events.
   */
  token: z.string().length(64, { message: 'token must be a 64-character hex string' }),

  /** Non-reversible fingerprint hash (screen+UA+lang+TZ) */
  session_id: z.string().min(1),

  event_type: z.enum(['pageview', 'event', 'session_start', 'session_end', 'funnel_step', 'scroll', 'click']),

  /** Full page URL */
  url: z.string().min(1),

  referrer: z.string().optional(),
  title: z.string().optional(),

  screen_width: z.number().int().positive().optional(),
  screen_height: z.number().int().positive().optional(),
  language: z.string().max(35).optional(),
  timezone: z.string().max(64).optional(),

  /** Seconds on page — sent via sendBeacon on session_end */
  time_on_page: z.number().int().min(0).optional(),

  /** For event_type='event' or 'funnel_step' */
  custom_name: z.string().max(100).optional(),
  custom_properties: z.record(z.unknown()).optional(),

  /** ISO 8601 client-side timestamp */
  timestamp: z.string().datetime({ message: 'timestamp must be an ISO 8601 datetime string' }),
})

export const collectRoute: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.post(
    '/collect',
    {
      schema: { body: collectBodySchema },
      // Disable rate-limit for OPTIONS preflight (handled by CORS plugin)
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const body = request.body

      // ── 1. Validate site + token (E3-F2 + E9-F2) ─────────────────────────
      // Both site_id and tracking_token must match the same active site.
      const site = await prisma.site.findFirst({
        where: {
          id: body.site_id,
          tracking_token: body.token,
          deleted_at: null,
        },
        select: { id: true },
      })
      if (!site) {
        return reply.code(401).send({ error: 'site_id หรือ token ไม่ถูกต้อง' })
      }

      // ── 2a. Bot detection (E3-F5) — check UA before spending time on geo ─
      const userAgent = request.headers['user-agent'] ?? ''
      const ua = parseUA(userAgent)
      if (ua.is_bot) {
        // Silently acknowledge — bots get a 200 so they don't retry
        return reply.code(200).send({ ok: true })
      }

      // ── 2b. GeoIP enrichment (E3-F3) ─────────────────────────────────────
      // request.ip is X-Forwarded-For-aware when behind nginx (trustProxy: true)
      const geo = lookupGeo(request.ip)

      // ── 3. Build enriched event ───────────────────────────────────────────
      // Zod infers optional fields as `T | undefined` rather than `T?`, which
      // is technically incompatible with exactOptionalPropertyTypes. The data
      // is already validated, so the cast is safe.
      const enriched = {
        ...body,
        country_code: geo.country_code,
        region: geo.region,
        device_type: ua.device_type,
        browser: ua.browser_name,
        os: ua.os_name,
      } as unknown as EnrichedEvent

      // ── 4. Buffer + publish (E3-F7) ───────────────────────────────────────
      // Both operations must not crash the endpoint if they fail.
      await Promise.all([
        pushToBuffer(enriched).catch((err: unknown) =>
          request.log.error({ err }, 'buffer push failed'),
        ),
        publishRealtimeEvent(body.site_id, enriched).catch(() => {
          /* already logged inside publishRealtimeEvent */
        }),
      ])

      return reply.code(202).send({ ok: true })
    },
  )
}
