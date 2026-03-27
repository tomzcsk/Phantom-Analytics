import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import { requireAuth, requireRole } from './auth.js'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  user_id: z.string().uuid().optional(),
  action: z.string().optional(),
  entity_type: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const activityLogRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', requireAuth)
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.get(
    '/activity-logs',
    { schema: { querystring: querySchema }, preHandler: [requireRole('admin')] },
    async (request, reply) => {
      const { page, limit, user_id, action, entity_type, from, to } = request.query

      const where: Record<string, unknown> = {}
      if (user_id) where['user_id'] = user_id
      if (action) where['action'] = action
      if (entity_type) where['entity_type'] = entity_type
      if (from || to) {
        const created_at: Record<string, Date> = {}
        if (from) created_at['gte'] = new Date(from)
        if (to) {
          const toDate = new Date(to)
          toDate.setDate(toDate.getDate() + 1)
          created_at['lt'] = toDate
        }
        where['created_at'] = created_at
      }

      const [data, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.activityLog.count({ where }),
      ])

      return reply.send({
        data: data.map((d) => ({ ...d, created_at: d.created_at.toISOString() })),
        total,
        page,
        limit,
      })
    },
  )
}
