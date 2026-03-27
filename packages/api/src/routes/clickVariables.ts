import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import { requireAuth, requireRole } from './auth.js'
import { logActivity } from '../services/activityLog.js'

/**
 * Click Variables CRUD
 *
 * GET    /api/click-variables?site_id=...  — list all for site
 * POST   /api/click-variables              — create new variable
 * PUT    /api/click-variables/:id          — update name
 * DELETE /api/click-variables/:id          — delete
 */

export const clickVariablesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', requireAuth)
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  const siteQuerySchema = z.object({ site_id: z.string().uuid() })
  const idParamsSchema = z.object({ id: z.string().uuid() })

  const createBodySchema = z.object({
    site_id: z.string().uuid(),
    key: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'ใช้ได้เฉพาะ a-z, 0-9, _ และ -'),
    name: z.string().min(1).max(100),
  })

  const updateBodySchema = z.object({
    name: z.string().min(1).max(100),
  })

  // List
  app.get('/click-variables', { schema: { querystring: siteQuerySchema } }, async (request) => {
    const { site_id } = request.query
    return prisma.clickVariable.findMany({
      where: { site_id },
      orderBy: { created_at: 'desc' },
    })
  })

  // Create
  app.post('/click-variables', { schema: { body: createBodySchema }, preHandler: [requireRole('admin', 'developer')] }, async (request, reply) => {
    const { site_id, key, name } = request.body
    try {
      const variable = await prisma.clickVariable.create({
        data: { site_id, key, name },
      })
      logActivity({ userId: request.user.sub, userName: request.user.username, action: 'create', entityType: 'click_variable', entityId: variable.id, description: `สร้างตัวแปรคลิก "${name}" (${key})`, siteId: site_id })
      return reply.code(201).send(variable)
    } catch {
      return reply.code(409).send({ error: 'ตัวแปรนี้มีอยู่แล้ว' })
    }
  })

  // Update
  app.put('/click-variables/:id', { schema: { params: idParamsSchema, body: updateBodySchema }, preHandler: [requireRole('admin', 'developer')] }, async (request, reply) => {
    const { id } = request.params
    const { name } = request.body
    const variable = await prisma.clickVariable.update({
      where: { id },
      data: { name },
    })
    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'update', entityType: 'click_variable', entityId: id, description: `แก้ไขตัวแปรคลิก "${name}"`, siteId: variable.site_id })
    return reply.send(variable)
  })

  // Delete
  app.delete('/click-variables/:id', { schema: { params: idParamsSchema }, preHandler: [requireRole('admin', 'developer')] }, async (request, reply) => {
    const { id } = request.params
    const cv = await prisma.clickVariable.findUnique({ where: { id }, select: { name: true, key: true, site_id: true } })
    await prisma.clickVariable.delete({ where: { id } })
    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'delete', entityType: 'click_variable', entityId: id, description: `ลบตัวแปรคลิก "${cv?.name}" (${cv?.key})`, siteId: cv?.site_id ?? undefined })
    return reply.code(204).send()
  })
}
