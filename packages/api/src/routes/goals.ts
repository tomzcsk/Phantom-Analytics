import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import { requireAuth, requireRole } from './auth.js'
import { logActivity } from '../services/activityLog.js'
import { periodStart, periodEnd, countEvents } from '../services/goalChecker.js'

function n(v: unknown): number { return Number(v ?? 0) }

/** Calculate pace projection and status */
function calcPace(current: number, target: number, period: string) {
  const start = periodStart(period)
  const end = periodEnd(period, start)
  const now = new Date()

  const totalMs = end.getTime() - start.getTime()
  const elapsedMs = Math.max(now.getTime() - start.getTime(), 1)
  const timeElapsedPct = Math.min(Math.round((elapsedMs / totalMs) * 100), 100)

  const daysInPeriod = totalMs / 86_400_000
  const daysElapsed = Math.max(elapsedMs / 86_400_000, 0.1)
  const dailyRate = current / daysElapsed
  const projected = Math.round(dailyRate * daysInPeriod)

  const pct = target > 0 ? (current / target) * 100 : 0

  let status: string
  if (pct >= 150) status = 'exceeded'
  else if (pct >= 100) status = 'reached'
  else if (projected >= target * 0.8) status = 'on_track'
  else if (projected >= target * 0.5) status = 'at_risk'
  else status = 'behind'

  return {
    status,
    pace_projected: projected,
    time_elapsed_pct: timeElapsedPct,
  }
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

    const results = await Promise.all(goals.map(async (goal) => {
      const start = periodStart(goal.period)
      const end = periodEnd(goal.period, start)
      const current = await countEvents(goal.site_id, goal.event_match, start, end)
      const percentage = goal.target_value > 0 ? Math.min(Math.round((current / goal.target_value) * 100), 999) : 0
      const pace = calcPace(current, goal.target_value, goal.period)

      // Get previous period percentage from snapshots
      const prevSnapshot = await prisma.goalSnapshot.findFirst({
        where: { goal_id: goal.id },
        orderBy: { period_start: 'desc' },
        select: { percentage: true },
      })

      return {
        id: goal.id,
        name: goal.name,
        event_match: goal.event_match,
        target_value: goal.target_value,
        period: goal.period,
        current_value: current,
        percentage,
        status: pace.status,
        pace_projected: pace.pace_projected,
        time_elapsed_pct: pace.time_elapsed_pct,
        previous_percentage: prevSnapshot?.percentage ?? null,
        created_at: goal.created_at.toISOString(),
      }
    }))

    return reply.send(results)
  })

  // GET /api/goals/:id/history?limit=8
  app.get('/goals/:id/history', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      querystring: z.object({ limit: z.coerce.number().int().min(1).max(24).default(8) }),
    },
  }, async (request, reply) => {
    const snapshots = await prisma.goalSnapshot.findMany({
      where: { goal_id: request.params.id },
      orderBy: { period_start: 'asc' },
      take: request.query.limit,
      select: {
        period_start: true,
        period_end: true,
        actual_value: true,
        target_value: true,
        percentage: true,
      },
    })

    return reply.send(snapshots.map((s) => ({
      period_start: s.period_start.toISOString().slice(0, 10),
      period_end: s.period_end.toISOString().slice(0, 10),
      actual_value: s.actual_value,
      target_value: s.target_value,
      percentage: s.percentage,
    })))
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
