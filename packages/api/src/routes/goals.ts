import { z } from 'zod'
import { Prisma } from '@prisma/client'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import { requireAuth, requireRole } from './auth.js'
import { logActivity } from '../services/activityLog.js'

function n(v: unknown): number { return Number(v ?? 0) }

/** Get the start of the current period for a goal. */
function periodStart(period: string): Date {
  const now = new Date()
  if (period === 'daily') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (period === 'weekly') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday start
    return new Date(now.getFullYear(), now.getMonth(), diff)
  }
  // monthly
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export const goalsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', requireAuth)
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  const createSchema = z.object({
    site_id: z.string().uuid(),
    name: z.string().min(1).max(100),
    event_match: z.string().min(1).max(100),
    target_value: z.number().int().min(1),
    period: z.enum(['daily', 'weekly', 'monthly']),
  })

  // POST /api/goals
  app.post('/goals', { schema: { body: createSchema }, preHandler: [requireRole('admin', 'developer')] }, async (request, reply) => {
    const goal = await prisma.goal.create({
      data: request.body,
      select: { id: true, name: true, event_match: true, target_value: true, period: true, created_at: true },
    })
    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'create', entityType: 'site', entityId: goal.id, description: `สร้างเป้าหมาย "${goal.name}"`, siteId: request.body.site_id })
    return reply.code(201).send(goal)
  })

  // GET /api/goals?site_id=
  app.get('/goals', { schema: { querystring: z.object({ site_id: z.string().uuid() }) } }, async (request, reply) => {
    const goals = await prisma.goal.findMany({
      where: { site_id: request.query.site_id },
      orderBy: { created_at: 'desc' },
    })

    // Compute progress for each goal
    const results = await Promise.all(goals.map(async (goal) => {
      const start = periodStart(goal.period)
      const [row] = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM events
        WHERE site_id = ${goal.site_id}::uuid
          AND timestamp >= ${start}
          AND (event_type = ${goal.event_match} OR custom_name = ${goal.event_match})
      `
      const current = n(row?.count)
      return {
        id: goal.id,
        name: goal.name,
        event_match: goal.event_match,
        target_value: goal.target_value,
        period: goal.period,
        current_value: current,
        percentage: Math.min(Math.round((current / goal.target_value) * 100), 100),
        created_at: goal.created_at.toISOString(),
      }
    }))

    return reply.send(results)
  })

  // DELETE /api/goals/:id
  app.delete('/goals/:id', { schema: { params: z.object({ id: z.string().uuid() }) }, preHandler: [requireRole('admin', 'developer')] }, async (request, reply) => {
    const goal = await prisma.goal.findUnique({ where: { id: request.params.id } })
    if (!goal) return reply.code(404).send({ error: 'ไม่พบเป้าหมาย' })

    await prisma.goal.delete({ where: { id: request.params.id } })
    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'delete', entityType: 'site', entityId: request.params.id, description: `ลบเป้าหมาย "${goal.name}"`, siteId: goal.site_id })
    return reply.code(204).send()
  })
}
