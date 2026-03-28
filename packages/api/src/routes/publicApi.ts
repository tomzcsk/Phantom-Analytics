import { z } from 'zod'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { PublicStatsResponse, TimeseriesPoint, PageStat, UtmStat } from '@phantom/shared'
import { prisma } from '../db/client.js'

/**
 * Public REST API v1 — authenticated via X-API-Key header.
 *
 * Routes:
 *   GET /api/v1/stats      — overview KPIs
 *   GET /api/v1/timeseries — time-bucketed trend data
 *   GET /api/v1/pages      — top pages
 *   GET /api/v1/sources    — UTM source breakdown
 */

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

function n(v: unknown): number {
  return Number(v ?? 0)
}

function tzBounds(from: string, to: string, tz: string) {
  const safeTz = tz.replace(/'/g, "''")
  const safeFrom = from.replace(/'/g, "''")
  const safeTo = to.replace(/'/g, "''")
  return {
    fromTs: Prisma.raw(`('${safeFrom}'::date::timestamp AT TIME ZONE '${safeTz}')`),
    toTs: Prisma.raw(`(('${safeTo}'::date + INTERVAL '1 day')::timestamp AT TIME ZONE '${safeTz}')`),
  }
}

function daysDiff(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000
}

// ── API key authentication hook ─────────────────────────────────────────

async function requireApiKey(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-api-key'] as string | undefined
  if (!apiKey) {
    return reply.code(401).send({ error: 'Missing X-API-Key header' })
  }

  const hash = hashKey(apiKey)
  const record = await prisma.apiKey.findUnique({
    where: { key_hash: hash },
    include: { site: { select: { id: true, deleted_at: true } } },
  })

  if (!record) {
    return reply.code(401).send({ error: 'Invalid API key' })
  }

  if (record.expires_at && record.expires_at < new Date()) {
    return reply.code(401).send({ error: 'API key expired' })
  }

  if (record.site.deleted_at) {
    return reply.code(404).send({ error: 'Site not found' })
  }

  // Update last_used timestamp (fire and forget)
  prisma.apiKey.update({ where: { id: record.id }, data: { last_used: new Date() } }).catch(() => {})

  // Attach site_id to request for route handlers
  ;(request as unknown as Record<string, unknown>)['apiSiteId'] = record.site_id
  ;(request as unknown as Record<string, unknown>)['apiScopes'] = record.scopes
}

// ── Common query schema ─────────────────────────────────────────────────

const datePattern = /^\d{4}-\d{2}-\d{2}$/

const publicQuerySchema = z.object({
  from: z.string().regex(datePattern, 'Expected YYYY-MM-DD').optional(),
  to: z.string().regex(datePattern, 'Expected YYYY-MM-DD').optional(),
  tz: z.string().default('Asia/Bangkok'),
})

function getDefaultRange() {
  const to = new Date().toISOString().slice(0, 10)
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 30)
  return { from: fromDate.toISOString().slice(0, 10), to }
}

// ── SQL result types ────────────────────────────────────────────────────

type StatsRow = {
  pageviews: bigint
  unique_visitors: bigint
  avg_session_duration: number | string
  bounce_rate: number | string
}
type TimeseriesRow = { bucket: Date; pageviews: bigint; visitors: bigint; sessions: bigint }
type PageRow = { url: string; pageviews: bigint; visitors: bigint }
type UtmRow = { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; count: bigint }

// ── Route plugin ────────────────────────────────────────────────────────

export const publicApiRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', requireApiKey)

  const app = fastify.withTypeProvider<ZodTypeProvider>()

  // ── GET /v1/stats ─────────────────────────────────────────────────────

  app.get('/v1/stats', { schema: { querystring: publicQuerySchema } }, async (request, reply) => {
    const siteId = (request as unknown as Record<string, unknown>)['apiSiteId'] as string
    const defaults = getDefaultRange()
    const from = request.query.from ?? defaults.from
    const to = request.query.to ?? defaults.to
    const { tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    const [row] = await prisma.$queryRaw<StatsRow[]>`
      WITH pv AS (
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
          COUNT(DISTINCT session_id) AS unique_visitors
        FROM events
        WHERE site_id = ${siteId}::uuid AND timestamp >= ${fromTs} AND timestamp < ${toTs}
      ),
      dur AS (
        SELECT COALESCE(AVG(time_on_page), 0) AS avg_session_duration
        FROM events
        WHERE site_id = ${siteId}::uuid AND event_type = 'session_end' AND time_on_page IS NOT NULL
          AND timestamp >= ${fromTs} AND timestamp < ${toTs}
      ),
      bounce AS (
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE COUNT(*) FILTER (WHERE pv_count = 1)::float / COUNT(*) END AS bounce_rate
        FROM (
          SELECT COUNT(*) FILTER (WHERE event_type = 'pageview') AS pv_count
          FROM events WHERE site_id = ${siteId}::uuid AND timestamp >= ${fromTs} AND timestamp < ${toTs}
          GROUP BY session_id
        ) s
      )
      SELECT
        (SELECT pageviews FROM pv)::bigint AS pageviews,
        (SELECT unique_visitors FROM pv)::bigint AS unique_visitors,
        (SELECT avg_session_duration FROM dur) AS avg_session_duration,
        (SELECT bounce_rate FROM bounce) AS bounce_rate
    `

    const response: PublicStatsResponse = {
      pageviews: n(row?.pageviews),
      visitors: n(row?.unique_visitors),
      bounce_rate: Math.round(n(row?.bounce_rate) * 1000) / 1000,
      avg_duration: Math.round(n(row?.avg_session_duration)),
      period: { from, to },
    }

    return reply.send(response)
  })

  // ── GET /v1/timeseries ────────────────────────────────────────────────

  app.get('/v1/timeseries', { schema: { querystring: publicQuerySchema } }, async (request, reply) => {
    const siteId = (request as unknown as Record<string, unknown>)['apiSiteId'] as string
    const defaults = getDefaultRange()
    const from = request.query.from ?? defaults.from
    const to = request.query.to ?? defaults.to
    const { tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    const days = daysDiff(from, to)
    const safeTz = tz.replace(/'/g, "''")
    const tzLiteral = Prisma.raw(`'${safeTz}'`)
    const bucketInterval = days < 2 ? '1 hour' : days < 90 ? '1 day' : '1 week'
    const intervalRaw = Prisma.raw(`'${bucketInterval}'`)
    const stepRaw = Prisma.raw(`'${bucketInterval}'::interval`)

    const rows = await prisma.$queryRaw<TimeseriesRow[]>`
      WITH buckets AS (
        SELECT generate_series(${from}::date, ${to}::date, ${stepRaw}) AS bucket
      ),
      data AS (
        SELECT
          time_bucket(${intervalRaw}, timestamp AT TIME ZONE ${tzLiteral}) AS bucket,
          COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
          COUNT(DISTINCT session_id) AS visitors,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'session_start') AS sessions
        FROM events
        WHERE site_id = ${siteId}::uuid AND timestamp >= ${fromTs} AND timestamp < ${toTs}
        GROUP BY 1
      )
      SELECT b.bucket, COALESCE(d.pageviews,0)::bigint AS pageviews, COALESCE(d.visitors,0)::bigint AS visitors, COALESCE(d.sessions,0)::bigint AS sessions
      FROM buckets b LEFT JOIN data d USING (bucket) ORDER BY b.bucket
    `

    const timeseries: TimeseriesPoint[] = rows.map((r) => ({
      timestamp: r.bucket.toISOString(),
      pageviews: n(r.pageviews),
      visitors: n(r.visitors),
      sessions: n(r.sessions),
    }))

    return reply.send(timeseries)
  })

  // ── GET /v1/pages ─────────────────────────────────────────────────────

  const pagesSchema = publicQuerySchema.extend({
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })

  app.get('/v1/pages', { schema: { querystring: pagesSchema } }, async (request, reply) => {
    const siteId = (request as unknown as Record<string, unknown>)['apiSiteId'] as string
    const defaults = getDefaultRange()
    const from = request.query.from ?? defaults.from
    const to = request.query.to ?? defaults.to
    const { tz, limit } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    const rows = await prisma.$queryRaw<PageRow[]>`
      SELECT
        url,
        COUNT(*) FILTER (WHERE event_type = 'pageview')::bigint AS pageviews,
        COUNT(DISTINCT session_id)::bigint AS visitors
      FROM events
      WHERE site_id = ${siteId}::uuid AND timestamp >= ${fromTs} AND timestamp < ${toTs}
      GROUP BY url ORDER BY pageviews DESC LIMIT ${limit}
    `

    const pages = rows.map((r) => ({
      url: r.url,
      pageviews: n(r.pageviews),
      visitors: n(r.visitors),
    }))

    return reply.send(pages)
  })

  // ── GET /v1/sources ───────────────────────────────────────────────────

  app.get('/v1/sources', { schema: { querystring: publicQuerySchema } }, async (request, reply) => {
    const siteId = (request as unknown as Record<string, unknown>)['apiSiteId'] as string
    const defaults = getDefaultRange()
    const from = request.query.from ?? defaults.from
    const to = request.query.to ?? defaults.to
    const { tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    const rows = await prisma.$queryRaw<UtmRow[]>`
      SELECT utm_source, utm_medium, utm_campaign, COUNT(DISTINCT session_id)::bigint AS count
      FROM events
      WHERE site_id = ${siteId}::uuid AND event_type = 'pageview' AND utm_source IS NOT NULL
        AND timestamp >= ${fromTs} AND timestamp < ${toTs}
      GROUP BY utm_source, utm_medium, utm_campaign ORDER BY count DESC LIMIT 50
    `

    const total = rows.reduce((sum, r) => sum + n(r.count), 0) || 1

    const sources: UtmStat[] = rows.map((r) => ({
      utm_source: r.utm_source,
      utm_medium: r.utm_medium,
      utm_campaign: r.utm_campaign,
      visitors: n(r.count),
      percentage: Math.round((n(r.count) / total) * 1000) / 10,
    }))

    return reply.send(sources)
  })
}
