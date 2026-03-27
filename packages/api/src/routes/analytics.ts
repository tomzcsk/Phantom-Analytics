import { Prisma } from '@prisma/client'
import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import type {
  OverviewResponse,
  TimeseriesPoint,
  PageStat,
  SourcesAnalyticsResponse,
  DeviceAnalyticsResponse,
  GeoStat,
  FunnelResult,
  FunnelStepResult,
  FunnelStep,
  ScrollDepthStat,
  ClickStat,
  TimezoneStat,
  RegionStat,
  UtmStat,
} from '@phantom/shared'
import { prisma } from '../db/client.js'
import { getRegionName } from '../services/regionNames.js'
import { requireAuth } from './auth.js'
import { canAccessSite } from '../services/siteAccess.js'

/**
 * Analytics query routes (E4-F1 through E4-F6, E4-F8)
 *
 * All time-series queries use TimescaleDB time_bucket() and continuous
 * aggregates per CLAUDE.md. DATE_TRUNC on the raw events table is prohibited.
 */

// ── Common schemas ─────────────────────────────────────────────────────────

const datePattern = /^\d{4}-\d{2}-\d{2}$/

const siteRangeSchema = z.object({
  site_id: z.string().uuid(),
  from: z.string().regex(datePattern, 'Expected YYYY-MM-DD'),
  to: z.string().regex(datePattern, 'Expected YYYY-MM-DD'),
  tz: z.string().default('Asia/Bangkok'),
})

// ── Helpers ────────────────────────────────────────────────────────────────

function daysDiff(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000
}

function previousPeriod(from: string, to: string) {
  const diffMs = Date.parse(to) - Date.parse(from)
  return {
    from: new Date(Date.parse(from) - diffMs).toISOString().slice(0, 10),
    to: from,
  }
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function n(v: unknown): number {
  return Number(v ?? 0)
}

/** Build safe Prisma.raw fragments for timezone-aware date boundaries.
 *  `from`/`to` are validated as YYYY-MM-DD by Zod schema, safe to inline. */
function tzBounds(from: string, to: string, tz: string) {
  const safeTz = tz.replace(/'/g, "''")
  const safeFrom = from.replace(/'/g, "''")
  const safeTo = to.replace(/'/g, "''")
  return {
    fromTs: Prisma.raw(`('${safeFrom}'::date::timestamp AT TIME ZONE '${safeTz}')`),
    toTs: Prisma.raw(`(('${safeTo}'::date + INTERVAL '1 day')::timestamp AT TIME ZONE '${safeTz}')`),
  }
}

// ── Raw SQL result types ───────────────────────────────────────────────────

type StatsRow = {
  pageviews: bigint
  unique_visitors: bigint
  avg_session_duration: number | string
  bounce_rate: number | string
  bounce_count: bigint
}

type TimeseriesRow = { bucket: Date; pageviews: bigint; visitors: bigint; sessions: bigint }
type PageRow = { url: string; pageviews: bigint; visitors: bigint; avg_duration: number | string }
type SparklineRow = { url: string; day: Date; pv_count: bigint }
type SourceRow = { source: string; count: bigint }
type ReferrerRow = { domain: string; count: bigint }
type DeviceRow = { device_type: string | null; count: bigint }
type BrowserRow = { browser: string | null; count: bigint }
type OSRow = { os: string | null; count: bigint }
type GeoRow = { country_code: string; count: bigint }
type ScrollDepthRow = {
  url: string
  avg_max_depth: number | string
  reached_25: number | string
  reached_50: number | string
  reached_75: number | string
  reached_100: number | string
  total_pageviews: bigint
}
type ClickRow = { element_id: string; url: string; click_count: bigint; unique_clickers: bigint }

// ── Core metrics query (used by overview for current & previous period) ────

async function fetchMetrics(siteId: string, from: string, to: string, tz = 'Asia/Bangkok') {
  const { fromTs, toTs } = tzBounds(from, to, tz)
  const rows = await prisma.$queryRaw<StatsRow[]>`
    WITH pv AS (
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'pageview')  AS pageviews,
        COUNT(DISTINCT session_id)                         AS unique_visitors
      FROM events
      WHERE site_id    = ${siteId}::uuid
        AND timestamp >= ${fromTs}
        AND timestamp <  ${toTs}
    ),
    dur AS (
      SELECT COALESCE(AVG(time_on_page), 0) AS avg_session_duration
      FROM events
      WHERE site_id    = ${siteId}::uuid
        AND event_type = 'session_end'
        AND time_on_page IS NOT NULL
        AND timestamp >= ${fromTs}
        AND timestamp <  ${toTs}
    ),
    bounce AS (
      SELECT
        CASE WHEN COUNT(*) = 0 THEN 0
             ELSE COUNT(*) FILTER (WHERE pv_count = 1)::float / COUNT(*)
        END AS bounce_rate,
        COUNT(*) FILTER (WHERE pv_count = 1) AS bounce_count
      FROM (
        SELECT COUNT(*) FILTER (WHERE event_type = 'pageview') AS pv_count
        FROM events
        WHERE site_id    = ${siteId}::uuid
          AND timestamp >= ${fromTs}
          AND timestamp <  ${toTs}
        GROUP BY session_id
      ) s
    )
    SELECT
      (SELECT pageviews            FROM pv)::bigint AS pageviews,
      (SELECT unique_visitors      FROM pv)::bigint AS unique_visitors,
      (SELECT avg_session_duration FROM dur)         AS avg_session_duration,
      (SELECT bounce_rate          FROM bounce)      AS bounce_rate,
      (SELECT bounce_count         FROM bounce)::bigint AS bounce_count
  `
  const row = rows[0]
  return {
    pageviews: n(row?.pageviews),
    unique_visitors: n(row?.unique_visitors),
    avg_session_duration: Math.round(n(row?.avg_session_duration)),
    bounce_rate: Math.round(n(row?.bounce_rate) * 1000) / 1000,
    bounce_count: n(row?.bounce_count),
  }
}

// ── Route plugin ───────────────────────────────────────────────────────────

export const analyticsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', requireAuth)

  // Check site access for viewer users
  fastify.addHook('preHandler', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>
    const siteId = query['site_id']
    if (siteId && !(await canAccessSite(request.user.sub, request.user.role, siteId))) {
      reply.code(403).send({ error: 'ไม่มีสิทธิ์เข้าถึงเว็บไซต์นี้' })
    }
  })

  const app = fastify.withTypeProvider<ZodTypeProvider>()

  // ── E4-F1: Overview ──────────────────────────────────────────────────────

  app.get('/analytics/overview', { schema: { querystring: siteRangeSchema } }, async (request, reply) => {
    const { site_id, from, to, tz } = request.query

    const prev = previousPeriod(from, to)
    const [current, previous] = await Promise.all([
      fetchMetrics(site_id, from, to, tz),
      fetchMetrics(site_id, prev.from, prev.to, tz),
    ])

    const response: OverviewResponse = {
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

    return reply.send(response)
  })

  // ── E4-F2: Timeseries ────────────────────────────────────────────────────

  app.get('/analytics/timeseries', { schema: { querystring: siteRangeSchema } }, async (request, reply) => {
    const { site_id, from, to, tz } = request.query
    const days = daysDiff(from, to)
    const { fromTs, toTs } = tzBounds(from, to, tz)
    const safeTz = tz.replace(/'/g, "''")
    const tzLiteral = Prisma.raw(`'${safeTz}'`)

    // Auto-select bucket: 1h for < 2d, 1d for < 90d, 1w otherwise
    const bucketInterval = days < 2 ? '1 hour' : days < 90 ? '1 day' : '1 week'
    const seriesStep = days < 2 ? '1 hour' : days < 90 ? '1 day' : '1 week'
    const intervalRaw = Prisma.raw(`'${bucketInterval}'`)
    const stepRaw = Prisma.raw(`'${seriesStep}'::interval`)

    const rows = await prisma.$queryRaw<TimeseriesRow[]>`
      WITH buckets AS (
        SELECT generate_series(
          ${from}::date,
          ${to}::date,
          ${stepRaw}
        ) AS bucket
      ),
      data AS (
        SELECT
          time_bucket(${intervalRaw}, timestamp AT TIME ZONE ${tzLiteral}) AS bucket,
          COUNT(*) FILTER (WHERE event_type = 'pageview')      AS pageviews,
          COUNT(DISTINCT session_id)                            AS visitors,
          COUNT(DISTINCT session_id)
            FILTER (WHERE event_type = 'session_start')        AS sessions
        FROM events
        WHERE site_id    = ${site_id}::uuid
          AND timestamp >= ${fromTs}
          AND timestamp <  ${toTs}
        GROUP BY 1
      )
      SELECT
        b.bucket,
        COALESCE(d.pageviews, 0)::bigint AS pageviews,
        COALESCE(d.visitors,  0)::bigint AS visitors,
        COALESCE(d.sessions,  0)::bigint AS sessions
      FROM buckets b
      LEFT JOIN data d USING (bucket)
      ORDER BY b.bucket
    `

    const points: TimeseriesPoint[] = rows.map((r) => ({
      timestamp: r.bucket.toISOString(),
      pageviews: n(r.pageviews),
      visitors: n(r.visitors),
      sessions: n(r.sessions),
    }))

    return reply.send(points)
  })

  // ── E4-F3: Pages ─────────────────────────────────────────────────────────

  const pagesSchema = siteRangeSchema.extend({
    limit: z.coerce.number().int().min(1).max(100).default(10),
    offset: z.coerce.number().int().min(0).default(0),
    sort: z.enum(['pageviews', 'visitors', 'bounce_rate', 'avg_duration']).default('pageviews'),
  })

  app.get('/analytics/pages', { schema: { querystring: pagesSchema } }, async (request, reply) => {
    const { site_id, from, to, limit, offset, sort, tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)
    const sortCol = Prisma.raw(
      sort === 'visitors' ? 'visitors' :
      sort === 'bounce_rate' ? 'bounce_rate' :
      sort === 'avg_duration' ? 'avg_duration' :
      'pageviews'
    )

    const pageRows = await prisma.$queryRaw<(PageRow & { bounce_rate: number | string })[]>`
      WITH page_stats AS (
        SELECT
          url,
          COUNT(*) FILTER (WHERE event_type = 'pageview')       AS pageviews,
          COUNT(DISTINCT session_id)                              AS visitors,
          COALESCE(AVG(time_on_page) FILTER (
            WHERE event_type = 'session_end' AND time_on_page IS NOT NULL
          ), 0)                                                   AS avg_duration
        FROM events
        WHERE site_id    = ${site_id}::uuid
          AND event_type IN ('pageview', 'session_end')
          AND timestamp >= ${fromTs}
          AND timestamp <  ${toTs}
        GROUP BY url
      ),
      with_bounce AS (
        SELECT
          p.url,
          p.pageviews,
          p.visitors,
          p.avg_duration,
          COALESCE((
            SELECT CASE WHEN COUNT(*) = 0 THEN 0
                        ELSE COUNT(*) FILTER (WHERE pv_count = 1)::float / COUNT(*)
                   END
            FROM (
              SELECT session_id, COUNT(*) FILTER (WHERE event_type = 'pageview') AS pv_count
              FROM events
              WHERE site_id = ${site_id}::uuid
                AND url      = p.url
                AND timestamp >= ${fromTs}
                AND timestamp <  ${toTs}
              GROUP BY session_id
            ) s
          ), 0) AS bounce_rate
        FROM page_stats p
      )
      SELECT url, pageviews::bigint, visitors::bigint, avg_duration, bounce_rate
      FROM with_bounce
      ORDER BY ${sortCol} DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    if (pageRows.length === 0) {
      return reply.send([] as PageStat[])
    }

    // Fetch sparklines for returned pages in one query (last 30 days)
    const urls = pageRows.map((r) => r.url)
    const sparklineRows = await prisma.$queryRaw<SparklineRow[]>`
      SELECT
        url,
        time_bucket('1 day', timestamp) AS day,
        COUNT(*)::bigint                 AS pv_count
      FROM events
      WHERE site_id    = ${site_id}::uuid
        AND event_type = 'pageview'
        AND url        = ANY(${urls}::text[])
        AND timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY url, day
      ORDER BY url, day
    `

    // Build a 30-element zero-filled sparkline per URL
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sparkMap = new Map<string, number[]>()

    for (const url of urls) {
      sparkMap.set(url, new Array<number>(30).fill(0))
    }

    for (const row of sparklineRows) {
      const arr = sparkMap.get(row.url)
      if (!arr) continue
      const daysAgo = Math.floor((today.getTime() - row.day.getTime()) / 86_400_000)
      const idx = 29 - daysAgo
      if (idx >= 0 && idx < 30) arr[idx] = n(row.pv_count)
    }

    const pages: PageStat[] = pageRows.map((r) => ({
      url: r.url,
      pageviews: n(r.pageviews),
      visitors: n(r.visitors),
      bounce_rate: Math.round(n(r.bounce_rate) * 1000) / 1000,
      avg_duration: Math.round(n(r.avg_duration)),
      sparkline: sparkMap.get(r.url) ?? new Array<number>(30).fill(0),
    }))

    return reply.send(pages)
  })

  // ── E4-F4: Sources ────────────────────────────────────────────────────────

  app.get('/analytics/sources', { schema: { querystring: siteRangeSchema } }, async (request, reply) => {
    const { site_id, from, to, tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    // Get the site's own domain to filter out self-referrals
    const site = await prisma.site.findUnique({ where: { id: site_id }, select: { domain: true } })
    const selfDomain = site?.domain ?? ''

    const sourceRows = await prisma.$queryRaw<SourceRow[]>`
      SELECT
        CASE
          WHEN referrer IS NULL OR referrer = '' OR referrer ~ ${selfDomain}
            THEN 'direct'
          WHEN referrer ~ '(google\.|bing\.|yahoo\.|duckduckgo\.|baidu\.|yandex\.|ecosia\.)'
            THEN 'organic'
          WHEN referrer ~ '(twitter\.com|t\.co|x\.com|facebook\.com|fb\.com|linkedin\.com|instagram\.com|youtube\.com|reddit\.com|tiktok\.com|pinterest\.com|snapchat\.com)'
            THEN 'social'
          WHEN referrer ~ '(mail\.|gmail\.com|outlook\.|yahoo.*mail|hotmail\.|protonmail\.)'
            THEN 'email'
          WHEN referrer ~ 'utm_medium=cpc|utm_medium=paid|gclid=|fbclid='
            THEN 'paid'
          ELSE 'referral'
        END AS source,
        COUNT(DISTINCT session_id)::bigint AS count
      FROM events
      WHERE site_id    = ${site_id}::uuid
        AND event_type = 'pageview'
        AND timestamp >= ${fromTs}
        AND timestamp <  ${toTs}
      GROUP BY 1
    `

    const referrerRows = await prisma.$queryRaw<ReferrerRow[]>`
      SELECT
        REGEXP_REPLACE(
          REGEXP_REPLACE(referrer, '^https?://', ''),
          '/.*$', ''
        ) AS domain,
        COUNT(DISTINCT session_id)::bigint AS count
      FROM events
      WHERE site_id    = ${site_id}::uuid
        AND event_type = 'pageview'
        AND referrer IS NOT NULL
        AND referrer != ''
        AND referrer !~ ${selfDomain}
        AND timestamp >= ${fromTs}
        AND timestamp <  ${toTs}
      GROUP BY 1
      ORDER BY count DESC
      LIMIT 10
    `

    const total = sourceRows.reduce((sum, r) => sum + n(r.count), 0) || 1
    const refTotal = referrerRows.reduce((sum, r) => sum + n(r.count), 0) || 1

    const allSources = ['direct', 'organic', 'referral', 'social', 'email', 'paid'] as const
    const sourceMap = new Map(sourceRows.map((r) => [r.source, n(r.count)]))

    const response: SourcesAnalyticsResponse = {
      sources: allSources.map((s) => {
        const count = sourceMap.get(s) ?? 0
        return { source: s, count, percentage: Math.round((count / total) * 1000) / 10 }
      }),
      top_referrers: referrerRows.map((r) => ({
        domain: r.domain,
        count: n(r.count),
        percentage: Math.round((n(r.count) / refTotal) * 1000) / 10,
      })),
    }

    return reply.send(response)
  })

  // ── UTM Sources ─────────────────────────────────────────────────────────

  type UtmRow = { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; count: bigint }

  app.get('/analytics/sources/utm', { schema: { querystring: siteRangeSchema } }, async (request, reply) => {
    const { site_id, from, to, tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    const rows = await prisma.$queryRaw<UtmRow[]>`
      SELECT
        utm_source,
        utm_medium,
        utm_campaign,
        COUNT(DISTINCT session_id)::bigint AS count
      FROM events
      WHERE site_id    = ${site_id}::uuid
        AND event_type = 'pageview'
        AND utm_source IS NOT NULL
        AND timestamp >= ${fromTs}
        AND timestamp <  ${toTs}
      GROUP BY utm_source, utm_medium, utm_campaign
      ORDER BY count DESC
      LIMIT 50
    `

    const total = rows.reduce((sum, r) => sum + n(r.count), 0) || 1

    const response: UtmStat[] = rows.map((r) => ({
      utm_source: r.utm_source,
      utm_medium: r.utm_medium,
      utm_campaign: r.utm_campaign,
      visitors: n(r.count),
      percentage: Math.round((n(r.count) / total) * 1000) / 10,
    }))

    return reply.send(response)
  })

  // ── E4-F5: Devices ────────────────────────────────────────────────────────

  app.get('/analytics/devices', { schema: { querystring: siteRangeSchema } }, async (request, reply) => {
    const { site_id, from, to, tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    const [deviceRows, browserRows, osRows] = await Promise.all([
      prisma.$queryRaw<DeviceRow[]>`
        SELECT
          COALESCE(device_type, 'unknown')  AS device_type,
          COUNT(DISTINCT session_id)::bigint AS count
        FROM events
        WHERE site_id    = ${site_id}::uuid
          AND event_type = 'pageview'
          AND timestamp >= ${fromTs}
          AND timestamp <  ${toTs}
        GROUP BY 1 ORDER BY count DESC
      `,
      prisma.$queryRaw<BrowserRow[]>`
        SELECT
          COALESCE(browser, 'Unknown')      AS browser,
          COUNT(DISTINCT session_id)::bigint AS count
        FROM events
        WHERE site_id    = ${site_id}::uuid
          AND event_type = 'pageview'
          AND timestamp >= ${fromTs}
          AND timestamp <  ${toTs}
        GROUP BY 1 ORDER BY count DESC LIMIT 5
      `,
      prisma.$queryRaw<OSRow[]>`
        SELECT
          COALESCE(os, 'Unknown')           AS os,
          COUNT(DISTINCT session_id)::bigint AS count
        FROM events
        WHERE site_id    = ${site_id}::uuid
          AND event_type = 'pageview'
          AND timestamp >= ${fromTs}
          AND timestamp <  ${toTs}
        GROUP BY 1 ORDER BY count DESC LIMIT 5
      `,
    ])

    const devTotal = deviceRows.reduce((s, r) => s + n(r.count), 0) || 1
    const brTotal = browserRows.reduce((s, r) => s + n(r.count), 0) || 1
    const osTotal = osRows.reduce((s, r) => s + n(r.count), 0) || 1

    const response: DeviceAnalyticsResponse = {
      devices: deviceRows
        .filter((r): r is DeviceRow & { device_type: 'desktop' | 'mobile' | 'tablet' } =>
          r.device_type === 'desktop' || r.device_type === 'mobile' || r.device_type === 'tablet',
        )
        .map((r) => ({
          device_type: r.device_type,
          count: n(r.count),
          percentage: Math.round((n(r.count) / devTotal) * 1000) / 10,
        })),
      browsers: browserRows.map((r) => ({
        browser: r.browser ?? 'Unknown',
        count: n(r.count),
        percentage: Math.round((n(r.count) / brTotal) * 1000) / 10,
      })),
      operating_systems: osRows.map((r) => ({
        os: r.os ?? 'Unknown',
        count: n(r.count),
        percentage: Math.round((n(r.count) / osTotal) * 1000) / 10,
      })),
    }

    return reply.send(response)
  })

  // ── E4-F6: Geo ────────────────────────────────────────────────────────────

  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

  app.get('/analytics/geo', { schema: { querystring: siteRangeSchema } }, async (request, reply) => {
    const { site_id, from, to, tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    const rows = await prisma.$queryRaw<GeoRow[]>`
      SELECT
        country_code,
        COUNT(DISTINCT session_id)::bigint AS count
      FROM events
      WHERE site_id       = ${site_id}::uuid
        AND event_type    = 'pageview'
        AND country_code IS NOT NULL
        AND timestamp    >= ${fromTs}
        AND timestamp    <  ${toTs}
      GROUP BY country_code
      ORDER BY count DESC
      LIMIT 20
    `

    const total = rows.reduce((s, r) => s + n(r.count), 0) || 1

    const stats: GeoStat[] = rows.map((r) => ({
      country_code: r.country_code,
      country_name: regionNames.of(r.country_code) ?? r.country_code,
      visitors: n(r.count),
      percentage: Math.round((n(r.count) / total) * 1000) / 10,
    }))

    return reply.send(stats)
  })

  // ── E4-F8: Funnel analytics ───────────────────────────────────────────────

  const funnelQuerySchema = siteRangeSchema
  const funnelParamsSchema = z.object({ funnel_id: z.string().uuid() })

  app.get(
    '/analytics/funnel/:funnel_id',
    { schema: { params: funnelParamsSchema, querystring: funnelQuerySchema } },
    async (request, reply) => {
      const { funnel_id } = request.params
      const { site_id, from, to, tz } = request.query as { site_id: string; from: string; to: string; tz: string }
      const { fromTs, toTs } = tzBounds(from, to, tz)

      const funnel = await prisma.funnel.findFirst({
        where: { id: funnel_id, site_id },
      })
      if (!funnel) return reply.code(404).send({ error: 'ไม่พบ Funnel' })

      const steps = funnel.steps as unknown as FunnelStep[]

      // Count sessions that completed each step independently.
      // For ordered funnels (requiring sequential completion), E8-F1 will
      // populate funnel_events and this query will be enhanced.
      // Get site domain to build full URL patterns
      const siteForFunnel = await prisma.site.findFirst({ where: { id: site_id }, select: { domain: true } })
      const funnelDomain = siteForFunnel?.domain ?? ''

      const stepCounts = await Promise.all(
        steps.map(async (step) => {
          if (step.type === 'page_url') {
            // Full URL match: e.g. "http://localhost:8080/register"
            const fullSuffix = funnelDomain + step.value
            const rows = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
              `SELECT COUNT(DISTINCT session_id)::bigint AS count
               FROM events
               WHERE site_id = $1::uuid
                 AND event_type = 'pageview'
                 AND url LIKE '%' || $2
                 AND timestamp >= ($3::date::timestamp AT TIME ZONE $5)
                 AND timestamp < (($4::date + INTERVAL '1 day')::timestamp AT TIME ZONE $5)`,
              site_id, fullSuffix, from, to, tz,
            )
            return n(rows[0]?.count)
          } else {
            const rows = await prisma.$queryRaw<[{ count: bigint }]>`
              SELECT COUNT(DISTINCT session_id)::bigint AS count
              FROM events
              WHERE site_id    = ${site_id}::uuid
                AND event_type IN ('event', 'click')
                AND custom_name = ${step.value}
                AND timestamp >= ${fromTs}
                AND timestamp <  ${toTs}
            `
            return n(rows[0]?.count)
          }
        }),
      )

      const stepsResult: FunnelStepResult[] = steps.map((step, i) => {
        const entered = stepCounts[i] ?? 0
        // "completed" = sessions that also reached the next step
        const completed = i < steps.length - 1 ? Math.min(stepCounts[i + 1] ?? 0, entered) : entered
        const conversion_rate = entered > 0 ? Math.round((completed / entered) * 1000) / 1000 : 0
        return {
          ...step,
          entered,
          completed,
          conversion_rate,
          drop_off_rate: Math.round((1 - conversion_rate) * 1000) / 1000,
        }
      })

      const result: FunnelResult = {
        funnel_id,
        name: funnel.name,
        steps: stepsResult,
      }

      return reply.send(result)
    },
  )

  // ── Scroll Depth ──────────────────────────────────────────────────────────

  app.get('/analytics/scroll-depth', { schema: { querystring: siteRangeSchema } }, async (request, reply) => {
    const { site_id, from, to, tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    const rows = await prisma.$queryRaw<ScrollDepthRow[]>`
      WITH scroll_max AS (
        -- Max scroll depth per session per URL
        SELECT
          url,
          session_id,
          MAX((custom_properties->>'depth')::int) AS max_depth
        FROM events
        WHERE site_id    = ${site_id}::uuid
          AND event_type = 'scroll'
          AND custom_properties->>'depth' IS NOT NULL
          AND timestamp >= ${fromTs}
          AND timestamp <  ${toTs}
        GROUP BY url, session_id
      ),
      pv_counts AS (
        -- Total pageviews per URL for percentage denominators
        SELECT url, COUNT(*)::bigint AS total_pageviews
        FROM events
        WHERE site_id    = ${site_id}::uuid
          AND event_type = 'pageview'
          AND timestamp >= ${fromTs}
          AND timestamp <  ${toTs}
        GROUP BY url
      )
      SELECT
        p.url,
        COALESCE(AVG(s.max_depth), 0)                                            AS avg_max_depth,
        COALESCE(COUNT(*) FILTER (WHERE s.max_depth >= 25)::float
          / NULLIF(p.total_pageviews, 0) * 100, 0)                               AS reached_25,
        COALESCE(COUNT(*) FILTER (WHERE s.max_depth >= 50)::float
          / NULLIF(p.total_pageviews, 0) * 100, 0)                               AS reached_50,
        COALESCE(COUNT(*) FILTER (WHERE s.max_depth >= 75)::float
          / NULLIF(p.total_pageviews, 0) * 100, 0)                               AS reached_75,
        COALESCE(COUNT(*) FILTER (WHERE s.max_depth >= 100)::float
          / NULLIF(p.total_pageviews, 0) * 100, 0)                               AS reached_100,
        p.total_pageviews
      FROM pv_counts p
      LEFT JOIN scroll_max s USING (url)
      GROUP BY p.url, p.total_pageviews
      ORDER BY p.total_pageviews DESC
      LIMIT 20
    `

    const stats: ScrollDepthStat[] = rows.map((r) => ({
      url: r.url,
      avg_max_depth: Math.round(n(r.avg_max_depth) * 10) / 10,
      reached_25: Math.round(n(r.reached_25) * 10) / 10,
      reached_50: Math.round(n(r.reached_50) * 10) / 10,
      reached_75: Math.round(n(r.reached_75) * 10) / 10,
      reached_100: Math.round(n(r.reached_100) * 10) / 10,
      total_pageviews: n(r.total_pageviews),
    }))

    return reply.send(stats)
  })

  // ── Clicks ────────────────────────────────────────────────────────────────

  app.get('/analytics/clicks', { schema: { querystring: siteRangeSchema } }, async (request, reply) => {
    const { site_id, from, to, tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    const rows = await prisma.$queryRaw<ClickRow[]>`
      SELECT
        COALESCE(custom_name, 'unknown')    AS element_id,
        url,
        COUNT(*)::bigint                     AS click_count,
        COUNT(DISTINCT session_id)::bigint   AS unique_clickers
      FROM events
      WHERE site_id    = ${site_id}::uuid
        AND event_type = 'click'
        AND timestamp >= ${fromTs}
        AND timestamp <  ${toTs}
      GROUP BY custom_name, url
      ORDER BY click_count DESC
      LIMIT 50
    `

    const stats: ClickStat[] = rows.map((r) => ({
      element_id: r.element_id,
      url: r.url,
      click_count: n(r.click_count),
      unique_clickers: n(r.unique_clickers),
    }))

    return reply.send(stats)
  })

  // ── Timezones ──────────────────────────────────────────────────────────────

  type TimezoneRow = { timezone: string; count: bigint }

  app.get('/analytics/timezones', { schema: { querystring: siteRangeSchema } }, async (request, reply) => {
    const { site_id, from, to, tz } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    const rows = await prisma.$queryRaw<TimezoneRow[]>`
      SELECT
        timezone,
        COUNT(DISTINCT session_id)::bigint AS count
      FROM events
      WHERE site_id       = ${site_id}::uuid
        AND event_type    = 'pageview'
        AND timezone IS NOT NULL
        AND timestamp    >= ${fromTs}
        AND timestamp    <  ${toTs}
      GROUP BY timezone
      ORDER BY count DESC
      LIMIT 20
    `

    const total = rows.reduce((s, r) => s + n(r.count), 0) || 1

    const stats: TimezoneStat[] = rows.map((r) => ({
      timezone: r.timezone,
      visitors: n(r.count),
      percentage: Math.round((n(r.count) / total) * 1000) / 10,
    }))

    return reply.send(stats)
  })

  // ── Regions (by country) ───────────────────────────────────────────────────

  const regionQuerySchema = siteRangeSchema.extend({
    country_code: z.string().length(2),
  })

  type RegionRow = { region: string; count: bigint }

  app.get('/analytics/regions', { schema: { querystring: regionQuerySchema } }, async (request, reply) => {
    const { site_id, from, to, tz, country_code } = request.query
    const { fromTs, toTs } = tzBounds(from, to, tz)

    const rows = await prisma.$queryRaw<RegionRow[]>`
      SELECT
        region,
        COUNT(DISTINCT session_id)::bigint AS count
      FROM events
      WHERE site_id       = ${site_id}::uuid
        AND event_type    = 'pageview'
        AND country_code  = ${country_code}
        AND region IS NOT NULL
        AND region != ''
        AND timestamp    >= ${fromTs}
        AND timestamp    <  ${toTs}
      GROUP BY region
      ORDER BY count DESC
      LIMIT 20
    `

    const total = rows.reduce((s, r) => s + n(r.count), 0) || 1

    const stats: RegionStat[] = rows.map((r) => ({
      region: getRegionName(country_code, r.region),
      visitors: n(r.count),
      percentage: Math.round((n(r.count) / total) * 1000) / 10,
    }))

    return reply.send(stats)
  })
}
