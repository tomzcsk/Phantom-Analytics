import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import type { FunnelStep } from '@phantom/shared'
import { requireAuth, requireRole } from './auth.js'
import { logActivity } from '../services/activityLog.js'

/**
 * Funnels CRUD routes (E8-F1)
 *
 * POST   /api/funnels              — create funnel with ordered steps
 * GET    /api/funnels?site_id=...  — list funnels for a site
 * GET    /api/funnels/:id          — get funnel definition
 * PUT    /api/funnels/:id          — update funnel name + steps
 * DELETE /api/funnels/:id          — delete funnel (cascades funnel_events)
 */

const funnelStepSchema = z.object({
  index: z.number().int().min(0),
  label: z.string().min(1).max(100),
  type: z.enum(['page_url', 'event_name']),
  value: z.string().min(1).max(500),
})

const createBodySchema = z.object({
  site_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  steps: z.array(funnelStepSchema).min(2).max(10),
})

const updateBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  steps: z.array(funnelStepSchema).min(2).max(10).optional(),
})

const idParamsSchema = z.object({ id: z.string().uuid() })
const siteQuerySchema = z.object({ site_id: z.string().uuid() })

export const funnelsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', requireAuth)
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  // POST /api/funnels
  app.post('/funnels', { schema: { body: createBodySchema }, preHandler: [requireRole('admin', 'developer')] }, async (request, reply) => {
    const { site_id, name, steps } = request.body

    const site = await prisma.site.findFirst({ where: { id: site_id, deleted_at: null }, select: { id: true } })
    if (!site) return reply.code(404).send({ error: 'ไม่พบเว็บไซต์' })

    // Sort steps by index, re-number consecutively
    const sortedSteps: FunnelStep[] = [...steps]
      .sort((a, b) => a.index - b.index)
      .map((s, i) => ({ ...s, index: i }))

    const funnel = await prisma.funnel.create({
      data: {
        site_id,
        name,
        steps: sortedSteps as unknown as Parameters<typeof prisma.funnel.create>[0]['data']['steps'],
      },
      select: { id: true, site_id: true, name: true, steps: true, created_at: true },
    })

    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'create', entityType: 'funnel', entityId: funnel.id, description: `สร้างช่องทาง "${name}" (${steps.length} ขั้นตอน)`, siteId: site_id })
    return reply.code(201).send({
      ...funnel,
      steps: funnel.steps as unknown as FunnelStep[],
      created_at: funnel.created_at.toISOString(),
    })
  })

  // GET /api/funnels
  app.get('/funnels', { schema: { querystring: siteQuerySchema } }, async (request, reply) => {
    const { site_id } = request.query

    const funnels = await prisma.funnel.findMany({
      where: { site_id },
      orderBy: { created_at: 'asc' },
      select: { id: true, name: true, steps: true, created_at: true },
    })

    return reply.send(
      funnels.map((f) => ({
        ...f,
        steps: f.steps as unknown as FunnelStep[],
        created_at: f.created_at.toISOString(),
      })),
    )
  })

  // GET /api/funnels/:id
  app.get('/funnels/:id', { schema: { params: idParamsSchema } }, async (request, reply) => {
    const funnel = await prisma.funnel.findUnique({
      where: { id: request.params.id },
      select: { id: true, site_id: true, name: true, steps: true, created_at: true },
    })
    if (!funnel) return reply.code(404).send({ error: 'ไม่พบ Funnel' })

    return reply.send({
      ...funnel,
      steps: funnel.steps as unknown as FunnelStep[],
      created_at: funnel.created_at.toISOString(),
    })
  })

  // PUT /api/funnels/:id
  app.put(
    '/funnels/:id',
    { schema: { params: idParamsSchema, body: updateBodySchema }, preHandler: [requireRole('admin', 'developer')] },
    async (request, reply) => {
      const existing = await prisma.funnel.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      })
      if (!existing) return reply.code(404).send({ error: 'ไม่พบ Funnel' })

      const { name, steps } = request.body
      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData['name'] = name
      if (steps !== undefined) {
        updateData['steps'] = steps
          .sort((a, b) => a.index - b.index)
          .map((s, i) => ({ ...s, index: i })) as unknown as Parameters<typeof prisma.funnel.update>[0]['data']['steps']
      }

      const updated = await prisma.funnel.update({
        where: { id: request.params.id },
        data: updateData,
        select: { id: true, site_id: true, name: true, steps: true, created_at: true },
      })

      return reply.send({
        ...updated,
        steps: updated.steps as unknown as FunnelStep[],
        created_at: updated.created_at.toISOString(),
      })
    },
  )

  // DELETE /api/funnels/:id
  app.delete('/funnels/:id', { schema: { params: idParamsSchema }, preHandler: [requireRole('admin', 'developer')] }, async (request, reply) => {
    const existing = await prisma.funnel.findUnique({
      where: { id: request.params.id },
      select: { id: true },
    })
    if (!existing) return reply.code(404).send({ error: 'ไม่พบ Funnel' })

    const funnelData = await prisma.funnel.findUnique({ where: { id: request.params.id }, select: { name: true, site_id: true } })
    await prisma.funnel.delete({ where: { id: request.params.id } })
    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'delete', entityType: 'funnel', entityId: request.params.id, description: `ลบช่องทาง "${funnelData?.name}"`, siteId: funnelData?.site_id ?? undefined })
    return reply.code(204).send()
  })
}
