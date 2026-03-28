import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import { requireAuth } from './auth.js'

export const notificationsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', requireAuth)
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  // GET /api/notifications?site_id=&limit=50
  app.get('/notifications', {
    schema: {
      querystring: z.object({
        site_id: z.string().uuid(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        type: z.enum(['goal_reached', 'goal_warning', 'goal_exceeded']).optional(),
      }),
    },
  }, async (request, reply) => {
    const { site_id, limit, type } = request.query

    const notifications = await prisma.notification.findMany({
      where: {
        site_id,
        ...(type ? { type } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        goal: { select: { name: true, event_match: true } },
      },
    })

    return reply.send(notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      read: n.read,
      goal_name: n.goal.name,
      goal_event: n.goal.event_match,
      created_at: n.created_at.toISOString(),
    })))
  })

  // GET /api/notifications/unread-count?site_id=
  app.get('/notifications/unread-count', {
    schema: { querystring: z.object({ site_id: z.string().uuid() }) },
  }, async (request, reply) => {
    const count = await prisma.notification.count({
      where: { site_id: request.query.site_id, read: false },
    })
    return reply.send({ count })
  })

  // PUT /api/notifications/:id/read
  app.put('/notifications/:id/read', {
    schema: { params: z.object({ id: z.string().uuid() }) },
  }, async (request, reply) => {
    await prisma.notification.update({
      where: { id: request.params.id },
      data: { read: true },
    })
    return reply.send({ ok: true })
  })

  // PUT /api/notifications/read-all?site_id=
  app.put('/notifications/read-all', {
    schema: { querystring: z.object({ site_id: z.string().uuid() }) },
  }, async (request, reply) => {
    await prisma.notification.updateMany({
      where: { site_id: request.query.site_id, read: false },
      data: { read: true },
    })
    return reply.send({ ok: true })
  })
}
