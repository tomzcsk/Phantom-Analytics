import { z } from 'zod'
import { Prisma } from '@prisma/client'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import type { OverviewResponse, TimeseriesPoint } from '@phantom/shared'
import { prisma } from '../db/client.js'
import { requireAuth, requireRole } from './auth.js'
import { logActivity } from '../services/activityLog.js'

// ── Helpers (duplicated from analytics.ts to avoid circular imports) ──────

function daysDiff(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000
}

function previousPeriod(from: string, to: string) {
  const diffMs = Date.parse(to) - Date.parse(from)
  return { from: new Date(Date.parse(from) - diffMs).toISOString().slice(0, 10), to: from }
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function n(v: unknown): number { return Number(v ?? 0) }

function tzBounds(from: string, to: string, tz: string) {
  const safeTz = tz.replace(/'/g, "''")
  const safeFrom = from.replace(/'/g, "''")
  const safeTo = to.replace(/'/g, "''")
  return {
    fromTs: Prisma.raw(`('${safeFrom}'::date::timestamp AT TIME ZONE '${safeTz}')`),
    toTs: Prisma.raw(`(('${safeTo}'::date + INTERVAL '1 day')::timestamp AT TIME ZONE '${safeTz}')`),
  }
}

type StatsRow = { pageviews: bigint; unique_visitors: bigint; avg_session_duration: number | string; bounce_rate: number | string; bounce_count: bigint }
type TimeseriesRow = { bucket: Date; pageviews: bigint; visitors: bigint; sessions: bigint }

export const shareLinksRoute: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  // ── Authenticated CRUD ──────────────────────────────────────────────────

  const createSchema = z.object({
    site_id: z.string().uuid(),
    label: z.string().min(1).max(100),
    expires_days: z.number().int().min(1).max(365).default(30),
  })

  app.post('/share-links', { schema: { body: createSchema }, preHandler: [requireAuth, requireRole('admin', 'developer')] }, async (request, reply) => {
    const { site_id, label, expires_days } = request.body
    const expires_at = new Date()
    expires_at.setDate(expires_at.getDate() + expires_days)

    const link = await prisma.shareLink.create({
      data: { site_id, label, expires_at },
      select: { id: true, token: true, label: true, expires_at: true, created_at: true },
    })

    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'create', entityType: 'share_link', entityId: link.id, description: `สร้าง share link "${label}"`, siteId: site_id })
    return reply.code(201).send(link)
  })

  app.get('/share-links', { schema: { querystring: z.object({ site_id: z.string().uuid() }) }, preHandler: [requireAuth, requireRole('admin', 'developer')] }, async (request, reply) => {
    const links = await prisma.shareLink.findMany({
      where: { site_id: request.query.site_id },
      select: { id: true, token: true, label: true, expires_at: true, created_at: true },
      orderBy: { created_at: 'desc' },
    })
    return reply.send(links)
  })

  app.delete('/share-links/:id', { schema: { params: z.object({ id: z.string().uuid() }), querystring: z.object({ site_id: z.string().uuid() }) }, preHandler: [requireAuth, requireRole('admin', 'developer')] }, async (request, reply) => {
    const link = await prisma.shareLink.findUnique({ where: { id: request.params.id } })
    if (!link || link.site_id !== request.query.site_id) return reply.code(404).send({ error: 'ไม่พบ share link' })

    await prisma.shareLink.delete({ where: { id: request.params.id } })
    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'delete', entityType: 'share_link', entityId: request.params.id, description: `ลบ share link "${link.label}"`, siteId: link.site_id })
    return reply.code(204).send()
  })

  // ── Public endpoint (no auth) ───────────────────────────────────────────

  app.get('/public/:token', { schema: { params: z.object({ token: z.string().min(1) }) } }, async (request, reply) => {
    const link = await prisma.shareLink.findUnique({
      where: { token: request.params.token },
      include: { site: { select: { id: true, name: true, domain: true } } },
    })

    if (!link) return reply.code(404).send({ error: 'ไม่พบ share link' })
    if (link.expires_at < new Date()) return reply.code(410).send({ error: 'ลิงก์หมดอายุแล้ว' })

    const siteId = link.site_id
    const tz = 'Asia/Bangkok'
    const to = new Date().toISOString().slice(0, 10)
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 30)
    const from = fromDate.toISOString().slice(0, 10)

    const { fromTs, toTs } = tzBounds(from, to, tz)
    const prev = previousPeriod(from, to)
    const { fromTs: prevFromTs, toTs: prevToTs } = tzBounds(prev.from, prev.to, tz)

    // Overview KPIs
    const [currentStats] = await prisma.$queryRaw<StatsRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
        COUNT(DISTINCT session_id) AS unique_visitors,
        COALESCE(AVG(s.duration_seconds), 0) AS avg_session_duration,
        COALESCE(
          COUNT(*) FILTER (WHERE s.is_bounce = true)::float /
          NULLIF(COUNT(DISTINCT e.session_id), 0), 0
        ) AS bounce_rate,
        COUNT(*) FILTER (WHERE s.is_bounce = true) AS bounce_count
      FROM events e
      LEFT JOIN sessions s ON s.site_id = e.site_id AND s.session_id = e.session_id
      WHERE e.site_id = ${siteId}::uuid
        AND e.timestamp >= ${fromTs} AND e.timestamp < ${toTs}
    `

    const [prevStats] = await prisma.$queryRaw<StatsRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
        COUNT(DISTINCT session_id) AS unique_visitors,
        COALESCE(AVG(s.duration_seconds), 0) AS avg_session_duration,
        COALESCE(
          COUNT(*) FILTER (WHERE s.is_bounce = true)::float /
          NULLIF(COUNT(DISTINCT e.session_id), 0), 0
        ) AS bounce_rate,
        COUNT(*) FILTER (WHERE s.is_bounce = true) AS bounce_count
      FROM events e
      LEFT JOIN sessions s ON s.site_id = e.site_id AND s.session_id = e.session_id
      WHERE e.site_id = ${siteId}::uuid
        AND e.timestamp >= ${prevFromTs} AND e.timestamp < ${prevToTs}
    `

    const current = {
      pageviews: n(currentStats?.pageviews),
      unique_visitors: n(currentStats?.unique_visitors),
      avg_session_duration: Number(currentStats?.avg_session_duration ?? 0),
      bounce_rate: Number(currentStats?.bounce_rate ?? 0),
      bounce_count: n(currentStats?.bounce_count),
    }
    const previous = {
      pageviews: n(prevStats?.pageviews),
      unique_visitors: n(prevStats?.unique_visitors),
      avg_session_duration: Number(prevStats?.avg_session_duration ?? 0),
      bounce_rate: Number(prevStats?.bounce_rate ?? 0),
      bounce_count: n(prevStats?.bounce_count),
    }

    const overview: OverviewResponse = {
      pageviews: current.pageviews,
      unique_visitors: current.unique_visitors,
      avg_session_duration: current.avg_session_duration,
      bounce_rate: current.bounce_rate,
      bounce_count: current.bounce_count,
      pageviews_change: pctChange(current.pageviews, previous.pageviews),
      visitors_change: pctChange(current.unique_visitors, previous.unique_visitors),
      duration_change: pctChange(current.avg_session_duration, previous.avg_session_duration),
      bounce_change: pctChange(current.bounce_rate, previous.bounce_rate),
    }

    // Timeseries (30 days, daily buckets)
    const days = daysDiff(from, to)
    const safeTz = tz.replace(/'/g, "''")
    const tzLiteral = Prisma.raw(`'${safeTz}'`)
    const bucketInterval = days < 2 ? '1 hour' : days < 90 ? '1 day' : '1 week'
    const intervalRaw = Prisma.raw(`'${bucketInterval}'`)
    const stepRaw = Prisma.raw(`'${bucketInterval}'::interval`)

    const tsRows = await prisma.$queryRaw<TimeseriesRow[]>`
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

    const timeseries: TimeseriesPoint[] = tsRows.map((r) => ({
      timestamp: r.bucket.toISOString(),
      pageviews: n(r.pageviews),
      visitors: n(r.visitors),
      sessions: n(r.sessions),
    }))

    return reply.send({
      site: { name: link.site.name, domain: link.site.domain },
      overview,
      timeseries,
      range: { from, to },
    })
  })
}
