import { z } from 'zod'
import crypto from 'node:crypto'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'
import { hashPassword } from '../services/password.js'
import { requireAuth, requireRole } from './auth.js'
import { logActivity } from '../services/activityLog.js'

/**
 * User management routes (admin only)
 *
 * GET    /api/users            — list all users
 * GET    /api/users/:id        — get single user
 * PUT    /api/users/:id        — update role/display_name
 * DELETE /api/users/:id        — delete user (cannot delete self)
 * PUT    /api/users/:id/password — change password (admin or self)
 */

const userSelect = {
  id: true,
  username: true,
  display_name: true,
  role: true,
  created_at: true,
} as const

const idParamsSchema = z.object({ id: z.string().uuid() })

const updateBodySchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'developer', 'viewer']).optional(),
})

const passwordBodySchema = z.object({
  password: z.string().min(8),
})

export const usersRoute: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  // All routes require admin (except password change which also allows self)
  app.addHook('onRequest', requireAuth)

  // GET /api/users
  app.get('/users', { preHandler: [requireRole('admin')] }, async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { created_at: 'asc' },
    })
    return reply.send(users.map((u) => ({ ...u, created_at: u.created_at.toISOString() })))
  })

  // GET /api/users/:id
  app.get('/users/:id', { schema: { params: idParamsSchema }, preHandler: [requireRole('admin')] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      select: userSelect,
    })
    if (!user) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' })
    return reply.send({ ...user, created_at: user.created_at.toISOString() })
  })

  // PUT /api/users/:id
  app.put('/users/:id', { schema: { params: idParamsSchema, body: updateBodySchema }, preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { display_name, role } = request.body

    const existing = await prisma.user.findUnique({ where: { id: request.params.id }, select: { id: true } })
    if (!existing) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' })

    const user = await prisma.user.update({
      where: { id: request.params.id },
      data: {
        ...(display_name !== undefined ? { display_name } : {}),
        ...(role !== undefined ? { role } : {}),
      },
      select: userSelect,
    })
    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'update', entityType: 'user', entityId: request.params.id, description: `แก้ไขผู้ใช้ "${user.display_name}"${role ? ` → ${role}` : ''}`, metadata: { display_name, role } })
    return reply.send({ ...user, created_at: user.created_at.toISOString() })
  })

  // DELETE /api/users/:id
  app.delete('/users/:id', { schema: { params: idParamsSchema }, preHandler: [requireRole('admin')] }, async (request, reply) => {
    if (request.user.sub === request.params.id) {
      return reply.code(400).send({ error: 'ไม่สามารถลบบัญชีตัวเองได้' })
    }

    const existing = await prisma.user.findUnique({ where: { id: request.params.id }, select: { id: true } })
    if (!existing) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' })

    const delUser = await prisma.user.findUnique({ where: { id: request.params.id }, select: { display_name: true } })
    await prisma.user.delete({ where: { id: request.params.id } })
    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'delete', entityType: 'user', entityId: request.params.id, description: `ลบผู้ใช้ "${delUser?.display_name}"` })
    return reply.code(204).send()
  })

  // PUT /api/users/:id/password — admin or self
  app.put('/users/:id/password', { schema: { params: idParamsSchema, body: passwordBodySchema } }, async (request, reply) => {
    const isSelf = request.user.sub === request.params.id
    const isAdmin = request.user.role === 'admin'
    if (!isSelf && !isAdmin) {
      return reply.code(403).send({ error: 'ไม่มีสิทธิ์เข้าถึง' })
    }

    const existing = await prisma.user.findUnique({ where: { id: request.params.id }, select: { id: true } })
    if (!existing) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' })

    const password_hash = await hashPassword(request.body.password)
    await prisma.user.update({
      where: { id: request.params.id },
      data: { password_hash },
    })
    return reply.send({ ok: true })
  })

  // ── Site assignment ───────────────────────────────────────────────────

  const sitesBodySchema = z.object({
    site_ids: z.array(z.string().uuid()),
  })

  // GET /api/users/:id/sites — admin only
  app.get('/users/:id/sites', { schema: { params: idParamsSchema }, preHandler: [requireRole('admin')] }, async (request, reply) => {
    const assignments = await prisma.userSite.findMany({
      where: { user_id: request.params.id },
      select: { site_id: true },
    })
    return reply.send(assignments.map((a) => a.site_id))
  })

  // PUT /api/users/:id/sites — admin only, replace all assignments
  app.put('/users/:id/sites', { schema: { params: idParamsSchema, body: sitesBodySchema }, preHandler: [requireRole('admin')] }, async (request, reply) => {
    const { site_ids } = request.body

    const existing = await prisma.user.findUnique({ where: { id: request.params.id }, select: { id: true } })
    if (!existing) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' })

    // Replace all assignments in a transaction
    await prisma.$transaction([
      prisma.userSite.deleteMany({ where: { user_id: request.params.id } }),
      ...(site_ids.length > 0
        ? [prisma.userSite.createMany({
            data: site_ids.map((site_id) => ({ user_id: request.params.id, site_id })),
            skipDuplicates: true,
          })]
        : []),
    ])

    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'update', entityType: 'user', entityId: request.params.id, description: `กำหนดเว็บไซต์ (${site_ids.length} เว็บ)`, metadata: { site_ids } })
    return reply.send({ ok: true, site_ids })
  })

  // ── Magic link ────────────────────────────────────────────────────────

  // POST /api/users/:id/regenerate-token — admin only
  app.post('/users/:id/regenerate-token', { schema: { params: idParamsSchema }, preHandler: [requireRole('admin')] }, async (request, reply) => {
    const existing = await prisma.user.findUnique({ where: { id: request.params.id }, select: { id: true, role: true } })
    if (!existing) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' })

    const access_token = crypto.randomBytes(32).toString('hex')
    await prisma.user.update({
      where: { id: request.params.id },
      data: { access_token },
    })

    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'create', entityType: 'auth', entityId: request.params.id, description: `สร้างลิงก์เข้าถึงให้ "${existing.role}"` })
    return reply.send({ access_token })
  })
}
