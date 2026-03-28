import { z } from 'zod'
import { createHash, randomBytes } from 'node:crypto'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync } from 'fastify'
import type { ApiKeyInfo } from '@phantom/shared'
import { prisma } from '../db/client.js'
import { requireAuth, requireRole } from './auth.js'
import { logActivity } from '../services/activityLog.js'

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export const apiKeysRoute: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  // ── Create API Key ────────────────────────────────────────────────────
  const createSchema = z.object({
    site_id: z.string().uuid(),
    label: z.string().min(1).max(100),
    scopes: z.array(z.enum(['read', 'write'])).default(['read']),
    expires_days: z.number().int().min(1).max(365).optional(),
  })

  app.post('/api-keys', { schema: { body: createSchema }, preHandler: [requireAuth, requireRole('admin', 'developer')] }, async (request, reply) => {
    const { site_id, label, scopes, expires_days } = request.body

    // Generate a unique API key: pa_ prefix + 40 hex chars
    const rawKey = `pa_${randomBytes(20).toString('hex')}`
    const key_hash = hashKey(rawKey)
    const key_prefix = rawKey.slice(0, 8)

    const expires_at = expires_days
      ? new Date(Date.now() + expires_days * 86_400_000)
      : null

    const apiKey = await prisma.apiKey.create({
      data: { site_id, label, key_hash, key_prefix, scopes, expires_at },
      select: { id: true, label: true, key_prefix: true, scopes: true, expires_at: true, last_used: true, created_at: true },
    })

    logActivity({
      userId: request.user.sub,
      userName: request.user.username,
      action: 'create',
      entityType: 'api_key',
      entityId: apiKey.id,
      description: `สร้าง API key "${label}"`,
      siteId: site_id,
    })

    // Return the full key ONLY on creation — never again
    return reply.code(201).send({
      ...apiKey,
      expires_at: apiKey.expires_at?.toISOString() ?? null,
      last_used: null,
      created_at: apiKey.created_at.toISOString(),
      key: rawKey, // full key, show once only
    })
  })

  // ── List API Keys ─────────────────────────────────────────────────────
  app.get('/api-keys', { schema: { querystring: z.object({ site_id: z.string().uuid() }) }, preHandler: [requireAuth, requireRole('admin', 'developer')] }, async (request, reply) => {
    const keys = await prisma.apiKey.findMany({
      where: { site_id: request.query.site_id },
      select: { id: true, label: true, key_prefix: true, scopes: true, expires_at: true, last_used: true, created_at: true },
      orderBy: { created_at: 'desc' },
    })

    const result: ApiKeyInfo[] = keys.map((k) => ({
      id: k.id,
      label: k.label,
      key_prefix: k.key_prefix,
      scopes: k.scopes,
      expires_at: k.expires_at?.toISOString() ?? null,
      last_used: k.last_used?.toISOString() ?? null,
      created_at: k.created_at.toISOString(),
    }))

    return reply.send(result)
  })

  // ── Delete API Key ────────────────────────────────────────────────────
  app.delete('/api-keys/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      querystring: z.object({ site_id: z.string().uuid() }),
    },
    preHandler: [requireAuth, requireRole('admin', 'developer')],
  }, async (request, reply) => {
    const key = await prisma.apiKey.findUnique({ where: { id: request.params.id } })
    if (!key || key.site_id !== request.query.site_id) {
      return reply.code(404).send({ error: 'ไม่พบ API key' })
    }

    await prisma.apiKey.delete({ where: { id: request.params.id } })

    logActivity({
      userId: request.user.sub,
      userName: request.user.username,
      action: 'delete',
      entityType: 'api_key',
      entityId: request.params.id,
      description: `ลบ API key "${key.label}"`,
      siteId: key.site_id,
    })

    return reply.code(204).send()
  })
}
