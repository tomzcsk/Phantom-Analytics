import { z } from 'zod'
import { Prisma } from '@prisma/client'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import { requireAuth } from './auth.js'
import { canAccessSite } from '../services/siteAccess.js'

function n(v: unknown): number { return Number(v ?? 0) }

const datePattern = /^\d{4}-\d{2}-\d{2}$/

type EventRow = {
  id: string
  event_type: string
  url: string
  session_id: string
  country_code: string | null
  device_type: string | null
  custom_name: string | null
  timestamp: Date
}

type CountRow = { total: bigint }

export const eventsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', requireAuth)

  // Check site access
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
    from: z.string().regex(datePattern, 'Expected YYYY-MM-DD'),
    to: z.string().regex(datePattern, 'Expected YYYY-MM-DD'),
    tz: z.string().default('Asia/Bangkok'),
    event_type: z.string().optional(),
    url: z.string().optional(),
    session_id: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(50),
  })

  // GET /api/events — paginated raw events
  app.get('/events', { schema: { querystring: querySchema } }, async (request, reply) => {
    const { site_id, from, to, tz, event_type, url, session_id, page, limit } = request.query

    const safeTz = tz.replace(/'/g, "''")
    const fromTs = Prisma.raw(`('${from.replace(/'/g, "''")}'::date::timestamp AT TIME ZONE '${safeTz}')`)
    const toTs = Prisma.raw(`(('${to.replace(/'/g, "''")}'::date + INTERVAL '1 day')::timestamp AT TIME ZONE '${safeTz}')`)

    // Build dynamic WHERE conditions
    const conditions: string[] = []
    if (event_type) {
      conditions.push(`AND event_type = '${event_type.replace(/'/g, "''")}'`)
    }
    if (url) {
      conditions.push(`AND url ILIKE '%${url.replace(/'/g, "''").replace(/%/g, '\\%')}%'`)
    }
    if (session_id) {
      conditions.push(`AND session_id = '${session_id.replace(/'/g, "''")}'`)
    }
    const extraWhere = conditions.length > 0 ? Prisma.raw(conditions.join(' ')) : Prisma.empty

    const offset = (page - 1) * limit

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<EventRow[]>`
        SELECT id, event_type, url, session_id, country_code, device_type, custom_name, timestamp
        FROM events
        WHERE site_id = ${site_id}::uuid
          AND timestamp >= ${fromTs}
          AND timestamp < ${toTs}
          ${extraWhere}
        ORDER BY timestamp DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `,
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS total
        FROM events
        WHERE site_id = ${site_id}::uuid
          AND timestamp >= ${fromTs}
          AND timestamp < ${toTs}
          ${extraWhere}
      `,
    ])

    const total = n(countRows[0]?.total)

    return reply.send({
      data: rows.map((r) => ({
        id: r.id,
        event_type: r.event_type,
        url: r.url,
        session_id: r.session_id.slice(0, 12),
        country_code: r.country_code,
        device_type: r.device_type,
        custom_name: r.custom_name,
        timestamp: r.timestamp.toISOString(),
      })),
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    })
  })
}
