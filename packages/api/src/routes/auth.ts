import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/client.js'
import { hashPassword, verifyPassword } from '../services/password.js'
import { logActivity } from '../services/activityLog.js'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; username: string; role: string }
    user: { sub: string; username: string; role: string }
  }
}

const JWT_EXPIRY = '24h'

// ── Middleware ─────────────────────────────────────────────────────────────

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const query = request.query as Record<string, string | undefined>
    if (query['token'] && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${query['token']}`
    }
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'กรุณาเข้าสู่ระบบ' })
  }
}

export function requireRole(...roles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireAuth(request, reply)
    if (reply.sent) return
    if (!roles.includes(request.user.role)) {
      reply.code(403).send({ error: 'ไม่มีสิทธิ์เข้าถึง' })
    }
  }
}

// ── Schemas ───────────────────────────────────────────────────────────────

const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const registerBodySchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(8),
  display_name: z.string().min(1).max(100),
  role: z.enum(['admin', 'developer', 'viewer']).optional(),
})

// ── Helper ────────────────────────────────────────────────────────────────

function toProfile(user: { id: string; username: string; display_name: string; role: string; created_at: Date }) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    created_at: user.created_at.toISOString(),
  }
}

// ── Routes ────────────────────────────────────────────────────────────────

export const authRoute: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  // POST /api/auth/register
  app.post('/auth/register', { schema: { body: registerBodySchema } }, async (request, reply) => {
    const { username, password, display_name } = request.body

    const userCount = await prisma.user.count()
    if (userCount > 0) {
      try {
        await request.jwtVerify()
      } catch {
        return reply.code(401).send({ error: 'กรุณาเข้าสู่ระบบในฐานะ admin' })
      }
      if (request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'ไม่มีสิทธิ์เข้าถึง — ต้องเป็น admin' })
      }
    }

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return reply.code(409).send({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' })
    }

    const password_hash = await hashPassword(password)
    const role = userCount === 0 ? 'admin' : (request.body.role ?? 'viewer')

    const user = await prisma.user.create({
      data: { username, password_hash, display_name, role },
      select: { id: true, username: true, display_name: true, role: true, created_at: true },
    })

    logActivity({ userId: user.id, userName: user.display_name, action: 'create', entityType: 'user', entityId: user.id, description: `สร้างผู้ใช้ "${user.display_name}" (${user.role})` })
    return reply.code(201).send(toProfile(user))
  })

  // POST /api/auth/login
  app.post('/auth/login', { schema: { body: loginBodySchema } }, async (request, reply) => {
    const { username, password } = request.body

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      return reply.code(401).send({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      logActivity({ userId: user.id, userName: user.display_name, action: 'login_failed', entityType: 'auth', description: `เข้าสู่ระบบไม่สำเร็จ (${username})` })
      return reply.code(401).send({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
    }

    await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } })
    logActivity({ userId: user.id, userName: user.display_name, action: 'login', entityType: 'auth', description: `เข้าสู่ระบบ` })

    const token = fastify.jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      { expiresIn: JWT_EXPIRY },
    )

    return reply.send({ token, user: toProfile(user) })
  })

  // GET /api/auth/me
  app.get('/auth/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, username: true, display_name: true, role: true, created_at: true },
    })
    if (!user) {
      return reply.code(404).send({ error: 'ไม่พบผู้ใช้' })
    }
    return reply.send(toProfile(user))
  })

  // POST /api/auth/token-login — magic link (public, no auth)
  const tokenLoginSchema = z.object({ token: z.string().min(1) })

  app.post('/auth/token-login', { schema: { body: tokenLoginSchema } }, async (request, reply) => {
    const { token } = request.body

    const user = await prisma.user.findUnique({
      where: { access_token: token },
      select: { id: true, username: true, display_name: true, role: true, created_at: true },
    })
    if (!user) {
      return reply.code(401).send({ error: 'ลิงก์ไม่ถูกต้องหรือหมดอายุ' })
    }

    await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } })

    const jwt = fastify.jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      { expiresIn: JWT_EXPIRY },
    )

    return reply.send({ token: jwt, user: toProfile(user) })
  })

  // POST /api/auth/logout
  app.post('/auth/logout', async (_request, reply) => {
    return reply.send({ ok: true })
  })
}
