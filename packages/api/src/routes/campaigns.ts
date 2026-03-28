import { z } from 'zod'
import { Prisma } from '@prisma/client'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import type { CampaignStat, CampaignReportResponse, CampaignTimeseriesPoint } from '@phantom/shared'
import { prisma } from '../db/client.js'
import { requireAuth } from './auth.js'
import { canAccessSite } from '../services/siteAccess.js'

/**
 * Campaign analytics — UTM campaign performance report.
 * GET /api/analytics/campaigns
 */

function n(v: unknown): number {
  return Number(v ?? 0)
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
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

function previousPeriod(from: string, to: string) {
  const diffMs = Date.parse(to) - Date.parse(from)
  return { from: new Date(Date.parse(from) - diffMs).toISOString().slice(0, 10), to: from }
}

function daysDiff(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/

const campaignQuerySchema = z.object({
  site_id: z.string().uuid(),
  from: z.string().regex(datePattern, 'Expected YYYY-MM-DD'),
  to: z.string().regex(datePattern, 'Expected YYYY-MM-DD'),
  tz: z.string().default('Asia/Bangkok'),
})

// SQL result types
type CampaignRow = {
  utm_campaign: string
  utm_source: string | null
  utm_medium: string | null
  visitors: bigint
  pageviews: bigint
  bounce_rate: number | string
  avg_duration: number | string
  conversions: bigint
}

type PrevVisitorsRow = {
  utm_campaign: string
  visitors: bigint
}

type CampaignTsRow = {
  bucket: Date
  utm_campaign: string
  visitors: bigint
}

export const campaignsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', requireAuth)

  fastify.addHook('preHandler', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>
    const siteId = query['site_id']
    if (siteId && !(await canAccessSite(request.user.sub, request.user.role, siteId))) {
      reply.code(403).send({ error: 'ไม่มีสิทธิ์เข้าถึงเว็บไซต์นี้' })
    }
  })

  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.get('/analytics/campaigns', { schema: { querystring: campaignQuerySchema } }, async (request, reply) => {
    const { site_id, from, to, tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)
    const prev = previousPeriod(from, to)
    const { fromTs: prevFromTs, toTs: prevToTs } = tzBounds(prev.from, prev.to, tz)

    // Campaign metrics — group by campaign, pick dominant source/medium
    const campaignRows = await prisma.$queryRaw<CampaignRow[]>`
      WITH campaign_events AS (
        SELECT *
        FROM events
        WHERE site_id = ${site_id}::uuid
          AND utm_campaign IS NOT NULL
          AND timestamp >= ${fromTs} AND timestamp < ${toTs}
      ),
      campaign_stats AS (
        SELECT
          utm_campaign,
          -- Pick the most common source/medium per campaign
          (array_agg(utm_source ORDER BY utm_source))[1] AS utm_source,
          (array_agg(utm_medium ORDER BY utm_medium))[1] AS utm_medium,
          COUNT(DISTINCT session_id)::bigint AS visitors,
          COUNT(*) FILTER (WHERE event_type = 'pageview')::bigint AS pageviews,
          -- Bounce rate: sessions with only 1 pageview
          CASE WHEN COUNT(DISTINCT session_id) = 0 THEN 0
            ELSE (
              SELECT COUNT(*) FILTER (WHERE pv_count = 1)::float / NULLIF(COUNT(*), 0)
              FROM (
                SELECT session_id, COUNT(*) FILTER (WHERE event_type = 'pageview') AS pv_count
                FROM campaign_events ce2
                WHERE ce2.utm_campaign = ce.utm_campaign
                GROUP BY session_id
              ) s
            )
          END AS bounce_rate,
          -- Average duration from session_end events
          COALESCE((
            SELECT AVG(time_on_page)
            FROM campaign_events ce3
            WHERE ce3.utm_campaign = ce.utm_campaign AND ce3.event_type = 'session_end' AND ce3.time_on_page IS NOT NULL
          ), 0) AS avg_duration,
          -- Conversions: count of goal-related events (custom events excluding pageview/session events)
          COUNT(*) FILTER (WHERE event_type IN ('event', 'click', 'funnel_step'))::bigint AS conversions
        FROM campaign_events ce
        GROUP BY utm_campaign
      )
      SELECT * FROM campaign_stats ORDER BY visitors DESC LIMIT 50
    `

    // Previous period visitors per campaign for comparison
    const prevRows = await prisma.$queryRaw<PrevVisitorsRow[]>`
      SELECT utm_campaign, COUNT(DISTINCT session_id)::bigint AS visitors
      FROM events
      WHERE site_id = ${site_id}::uuid
        AND utm_campaign IS NOT NULL
        AND timestamp >= ${prevFromTs} AND timestamp < ${prevToTs}
      GROUP BY utm_campaign
    `
    const prevMap = new Map(prevRows.map((r) => [r.utm_campaign, n(r.visitors)]))

    const campaigns: CampaignStat[] = campaignRows.map((r) => ({
      utm_campaign: r.utm_campaign,
      utm_source: r.utm_source,
      utm_medium: r.utm_medium,
      visitors: n(r.visitors),
      pageviews: n(r.pageviews),
      bounce_rate: Math.round(n(r.bounce_rate) * 1000) / 1000,
      avg_duration: Math.round(n(r.avg_duration)),
      conversions: n(r.conversions),
      visitors_change: pctChange(n(r.visitors), prevMap.get(r.utm_campaign) ?? 0),
    }))

    // Timeseries per campaign (top 5)
    const days = daysDiff(from, to)
    const safeTz = tz.replace(/'/g, "''")
    const tzLiteral = Prisma.raw(`'${safeTz}'`)
    const bucketInterval = days < 2 ? '1 hour' : days < 90 ? '1 day' : '1 week'
    const intervalRaw = Prisma.raw(`'${bucketInterval}'`)

    const topCampaigns = campaigns.slice(0, 5).map((c) => c.utm_campaign)

    let timeseries: CampaignTimeseriesPoint[] = []
    if (topCampaigns.length > 0) {
      const tsRows = await prisma.$queryRaw<CampaignTsRow[]>`
        SELECT
          time_bucket(${intervalRaw}, timestamp AT TIME ZONE ${tzLiteral}) AS bucket,
          utm_campaign,
          COUNT(DISTINCT session_id)::bigint AS visitors
        FROM events
        WHERE site_id = ${site_id}::uuid
          AND utm_campaign = ANY(${topCampaigns}::text[])
          AND event_type = 'pageview'
          AND timestamp >= ${fromTs} AND timestamp < ${toTs}
        GROUP BY 1, 2
        ORDER BY 1
      `

      timeseries = tsRows.map((r) => ({
        timestamp: r.bucket.toISOString(),
        campaign: r.utm_campaign,
        visitors: n(r.visitors),
      }))
    }

    const response: CampaignReportResponse = { campaigns, timeseries }
    return reply.send(response)
  })
}
