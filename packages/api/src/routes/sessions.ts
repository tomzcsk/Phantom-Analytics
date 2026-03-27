import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import { requireAuth } from './auth.js'
import { canAccessSite } from '../services/siteAccess.js'

/**
 * Session routes (E7-F1, E7-F2)
 *
 * GET /api/sessions             — list sessions for a site+range
 * GET /api/sessions/:id/events  — get events for a session (journey data)
 */

const datePattern = /^\d{4}-\d{2}-\d{2}$/

const siteRangeSchema = z.object({
  site_id: z.string().uuid(),
  from: z.string().regex(datePattern, 'from must be YYYY-MM-DD'),
  to: z.string().regex(datePattern, 'to must be YYYY-MM-DD'),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

const idParamsSchema = z.object({ id: z.string().uuid() })

export const sessionsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', requireAuth)

  fastify.addHook('preHandler', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>
    const siteId = query['site_id']
    if (siteId && !(await canAccessSite(request.user.sub, request.user.role, siteId))) {
      reply.code(403).send({ error: 'ไม่มีสิทธิ์เข้าถึงเว็บไซต์นี้' })
    }
  })

  const app = fastify.withTypeProvider<ZodTypeProvider>()

  // GET /api/sessions
  app.get('/sessions', { schema: { querystring: siteRangeSchema } }, async (request, reply) => {
    const { site_id, from, to, limit } = request.query

    const sessions = await prisma.session.findMany({
      where: {
        site_id,
        started_at: {
          gte: new Date(`${from}T00:00:00Z`),
          lte: new Date(`${to}T23:59:59Z`),
        },
      },
      orderBy: { started_at: 'desc' },
      take: limit,
      select: {
        id: true,
        session_id: true,
        entry_page: true,
        exit_page: true,
        page_count: true,
        duration_seconds: true,
        is_bounce: true,
        started_at: true,
        ended_at: true,
      },
    })

    return reply.send(
      sessions.map((s) => ({
        ...s,
        started_at: s.started_at.toISOString(),
        ended_at: s.ended_at?.toISOString() ?? null,
      })),
    )
  })

  // GET /api/sessions/:id/events
  app.get(
    '/sessions/:id/events',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const session = await prisma.session.findUnique({
        where: { id: request.params.id },
        select: { site_id: true, session_id: true },
      })
      if (!session) return reply.code(404).send({ error: 'ไม่พบเซสชัน' })

      const events = await prisma.event.findMany({
        where: {
          site_id: session.site_id,
          session_id: session.session_id,
        },
        orderBy: { timestamp: 'asc' },
        select: {
          event_type: true,
          url: true,
          timestamp: true,
        },
      })

      return reply.send(
        events.map((e) => ({
          event_type: e.event_type,
          url: e.url,
          timestamp: e.timestamp.toISOString(),
        })),
      )
    },
  )
}
