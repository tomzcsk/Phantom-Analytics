import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import staticPlugin from '@fastify/static'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

import { prisma } from './db/client.js'
import { redis } from './db/redis.js'
import { startFlushLoop } from './services/buffer.js'
import { FastifySSEPlugin } from 'fastify-sse-v2'
import { collectRoute } from './routes/collect.js'
import { analyticsRoute } from './routes/analytics.js'
import { realtimeRoute } from './routes/realtime.js'
import { sitesRoute } from './routes/sites.js'
import { authRoute } from './routes/auth.js'
import { sessionsRoute } from './routes/sessions.js'
import { funnelsRoute } from './routes/funnels.js'
import { clickVariablesRoute } from './routes/clickVariables.js'
import { usersRoute } from './routes/users.js'
import { activityLogRoute } from './routes/activityLog.js'
import { shareLinksRoute } from './routes/shareLinks.js'
import { goalsRoute } from './routes/goals.js'
import { eventsRoute } from './routes/events.js'

import { startSessionAggregator } from './services/sessionAggregator.js'
import { startDataRetentionLoop } from './services/dataRetention.js'

/**
 * Phantom Analytics — Fastify API Server
 *
 * Architecture:
 * - Zod schema validation on every route (type-safe end-to-end)
 * - Redis-backed rate limiting per IP (E3-F6)
 * - Per-site CORS origin check (E3-F8)
 * - JWT authentication for dashboard routes (E9-F1)
 * - Structured JSON logging via Pino
 */

const server = Fastify({
  logger:
    process.env['NODE_ENV'] !== 'production'
      ? { level: 'debug', transport: { target: 'pino-pretty', options: { colorize: true } } }
      : { level: 'info' },
})

// ── Schema validation ──────────────────────────────────────────────────────

server.setValidatorCompiler(validatorCompiler)
server.setSerializerCompiler(serializerCompiler)

// ── CORS domain cache (E3-F8) ─────────────────────────────────────────────
// Querying the DB on every request is expensive; cache allowed domains for 60s.

let allowedDomains: Set<string> = new Set()
let domainCacheExpiry = 0

async function getAllowedDomains(): Promise<Set<string>> {
  if (Date.now() < domainCacheExpiry) return allowedDomains
  try {
    const sites = await prisma.site.findMany({
      where: { deleted_at: null },
      select: { domain: true },
    })
    allowedDomains = new Set(sites.map((s) => s.domain))
    domainCacheExpiry = Date.now() + 60_000
  } catch {
    // Return stale cache rather than blocking — DB might be temporarily down
  }
  return allowedDomains
}

// ── Plugin registration ────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // E3-F8: CORS — allow only registered site domains
  await server.register(cors, {
    origin: (origin, callback) => {
      // Allow same-origin requests (no Origin header) and server-to-server calls
      if (!origin) {
        callback(null, true)
        return
      }
      let hostname: string
      let host: string
      try {
        const url = new URL(origin)
        hostname = url.hostname
        host = url.host // includes port e.g. "localhost:8080"
      } catch {
        callback(null, false)
        return
      }
      getAllowedDomains()
        .then((domains) => callback(null, domains.has(hostname) || domains.has(host)))
        .catch(() => callback(null, false))
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })

  // E3-F6: Rate limiting — 100 req/min per IP, backed by Redis
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  })

  // Serve tracker script at /tracker.min.js
  const __dirname = dirname(fileURLToPath(import.meta.url))
  await server.register(staticPlugin, {
    root: join(__dirname, '../../../packages/tracker/dist'),
    prefix: '/',
    decorateReply: false,
  })

  // SSE plugin (E4-F7)
  await server.register(FastifySSEPlugin)

  // JWT (E9-F1 implements full auth flow)
  await server.register(jwt, {
    secret: process.env['JWT_SECRET'] ?? 'phantom-dev-secret-change-in-production',
  })

  // ── Health check (E3-F1) ──────────────────────────────────────────────────
  // Verifies both the PostgreSQL connection and Redis connection are alive.

  server.get('/health', async (_request, reply) => {
    const checks = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
    ])

    const db = checks[0].status === 'fulfilled' ? 'ok' : 'error'
    const cache = checks[1].status === 'fulfilled' ? 'ok' : 'error'
    const healthy = db === 'ok' && cache === 'ok'

    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { db, cache },
    })
  })

  // ── Route registration ────────────────────────────────────────────────────

  await server.register(collectRoute, { prefix: '/api' })
  await server.register(analyticsRoute, { prefix: '/api' })
  await server.register(realtimeRoute, { prefix: '/api' })
  await server.register(sitesRoute, { prefix: '/api' })
  await server.register(authRoute, { prefix: '/api' })
  await server.register(sessionsRoute, { prefix: '/api' })
  await server.register(funnelsRoute, { prefix: '/api' })
  await server.register(clickVariablesRoute, { prefix: '/api' })
  await server.register(usersRoute, { prefix: '/api' })
  await server.register(activityLogRoute, { prefix: '/api' })
  await server.register(shareLinksRoute, { prefix: '/api' })
  await server.register(goalsRoute, { prefix: '/api' })
  await server.register(eventsRoute, { prefix: '/api' })

  // ── Background jobs ───────────────────────────────────────────────────────

  // E3-F7: Start Redis → PostgreSQL flush loop (runs every 1s in background)
  await redis.connect()
  startFlushLoop()
  startSessionAggregator()
  startDataRetentionLoop()

  server.log.info('Bootstrap complete — flush loop started')
}

// ── Start ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env['API_PORT'] ?? '3001', 10)
const HOST = process.env['NODE_ENV'] === 'production' ? '0.0.0.0' : '127.0.0.1'

bootstrap()
  .then(async () => {
    await server.listen({ port: PORT, host: HOST })
  })
  .catch((err: unknown) => {
    server.log.error(err)
    process.exit(1)
  })

export default server
