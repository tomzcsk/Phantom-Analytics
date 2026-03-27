import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { generateSecret, generateURI, verifySync, TOTP } from 'otplib'
import { prisma } from '../db/client.js'
import { hashPassword, verifyPassword } from '../services/password.js'
import { logActivity } from '../services/activityLog.js'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; username: string; role: string; totp_pending?: boolean }
    user: { sub: string; username: string; role: string; totp_pending?: boolean }
  }
}

import { randomBytes } from 'node:crypto'

const JWT_EXPIRY = '24h'
const TOTP_TEMP_EXPIRY = '5m'
const BACKUP_CODE_COUNT = 8
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const RESET_TOKEN_EXPIRY_HOURS = 1

function generateBackupCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    codes.push(Math.random().toString(36).slice(2, 10).toUpperCase())
  }
  return codes
}

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

function toProfile(user: { id: string; username: string; display_name: string; role: string; created_at: Date; totp_enabled?: boolean }) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    totp_enabled: user.totp_enabled ?? false,
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

    // Account lockout check
    if (user.locked_until && user.locked_until > new Date()) {
      const remainMs = user.locked_until.getTime() - Date.now()
      const remainMin = Math.ceil(remainMs / 60_000)
      return reply.code(423).send({
        error: `บัญชีถูกล็อคชั่วคราว กรุณาลองใหม่ใน ${remainMin} นาที`,
        locked_until: user.locked_until.toISOString(),
        remaining_minutes: remainMin,
      })
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      const attempts = user.failed_login_attempts + 1
      const lockData: { failed_login_attempts: number; locked_until?: Date } = { failed_login_attempts: attempts }

      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date()
        lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_MINUTES)
        lockData.locked_until = lockUntil
      }

      await prisma.user.update({ where: { id: user.id }, data: lockData })
      logActivity({ userId: user.id, userName: user.display_name, action: 'login_failed', entityType: 'auth', description: `เข้าสู่ระบบไม่สำเร็จ (ครั้งที่ ${attempts})` })

      if (attempts >= MAX_FAILED_ATTEMPTS) {
        return reply.code(423).send({
          error: `เข้าสู่ระบบไม่สำเร็จ ${MAX_FAILED_ATTEMPTS} ครั้ง — บัญชีถูกล็อค ${LOCKOUT_MINUTES} นาที`,
          locked_until: lockData.locked_until!.toISOString(),
          remaining_minutes: LOCKOUT_MINUTES,
        })
      }

      return reply.code(401).send({
        error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
        remaining_attempts: MAX_FAILED_ATTEMPTS - attempts,
      })
    }

    // Reset failed attempts on successful login
    if (user.failed_login_attempts > 0 || user.locked_until) {
      await prisma.user.update({ where: { id: user.id }, data: { failed_login_attempts: 0, locked_until: null } })
    }

    // 2FA check: if enabled, return temporary token instead of full JWT
    if (user.totp_enabled) {
      const tempToken = fastify.jwt.sign(
        { sub: user.id, username: user.username, role: user.role, totp_pending: true },
        { expiresIn: TOTP_TEMP_EXPIRY },
      )
      return reply.code(202).send({ requires_totp: true, temp_token: tempToken })
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
      select: { id: true, username: true, display_name: true, role: true, totp_enabled: true, created_at: true },
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

  // POST /api/auth/verify-totp — verify TOTP code after password step
  const verifyTotpSchema = z.object({
    temp_token: z.string().min(1),
    code: z.string().min(1),
  })

  app.post('/auth/verify-totp', { schema: { body: verifyTotpSchema } }, async (request, reply) => {
    const { temp_token, code } = request.body

    let payload: { sub: string; username: string; role: string; totp_pending?: boolean }
    try {
      payload = fastify.jwt.verify(temp_token)
    } catch {
      return reply.code(401).send({ error: 'token หมดอายุ กรุณา login ใหม่' })
    }

    if (!payload.totp_pending) {
      return reply.code(400).send({ error: 'token ไม่ถูกต้อง' })
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.totp_secret) {
      return reply.code(401).send({ error: 'ไม่พบผู้ใช้' })
    }

    // Try TOTP code first
    const isValidTotp = verifySync({ secret: user.totp_secret, token: code })

    // Try backup codes if TOTP fails
    let usedBackupCode = false
    if (!isValidTotp) {
      const backupCodes = (user.backup_codes as string[] | null) ?? []
      const codeUpper = code.toUpperCase()
      const idx = backupCodes.indexOf(codeUpper)
      if (idx >= 0) {
        usedBackupCode = true
        const remaining = [...backupCodes]
        remaining.splice(idx, 1)
        await prisma.user.update({ where: { id: user.id }, data: { backup_codes: remaining } })
      } else {
        return reply.code(401).send({ error: 'รหัสยืนยันไม่ถูกต้อง' })
      }
    }

    await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } })
    logActivity({ userId: user.id, userName: user.display_name, action: 'login', entityType: 'auth', description: `เข้าสู่ระบบ (2FA${usedBackupCode ? ' — ใช้ backup code' : ''})` })

    const token = fastify.jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      { expiresIn: JWT_EXPIRY },
    )

    const profile = toProfile({ id: user.id, username: user.username, display_name: user.display_name, role: user.role, created_at: user.created_at })
    return reply.send({ token, user: profile })
  })

  // POST /api/auth/2fa/setup — generate TOTP secret + backup codes
  app.post('/auth/2fa/setup', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub } })
    if (!user) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' })
    if (user.totp_enabled) return reply.code(400).send({ error: '2FA เปิดใช้งานอยู่แล้ว' })

    const secret = generateSecret()
    const otpauth = generateURI({ issuer: 'Phantom Analytics', label: user.username, secret })
    const backupCodes = generateBackupCodes()

    // Store secret temporarily (not enabled yet until confirmed)
    await prisma.user.update({
      where: { id: user.id },
      data: { totp_secret: secret, backup_codes: backupCodes },
    })

    return reply.send({ secret, otpauth_uri: otpauth, backup_codes: backupCodes })
  })

  // POST /api/auth/2fa/confirm — verify first TOTP code to enable 2FA
  const confirmTotpSchema = z.object({ code: z.string().length(6) })

  app.post('/auth/2fa/confirm', { schema: { body: confirmTotpSchema }, preHandler: [requireAuth] }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub } })
    if (!user || !user.totp_secret) return reply.code(400).send({ error: 'กรุณา setup 2FA ก่อน' })
    if (user.totp_enabled) return reply.code(400).send({ error: '2FA เปิดใช้งานอยู่แล้ว' })

    const isValid = verifySync({ secret: user.totp_secret, token: request.body.code })
    if (!isValid) return reply.code(400).send({ error: 'รหัสไม่ถูกต้อง กรุณาลองใหม่' })

    await prisma.user.update({ where: { id: user.id }, data: { totp_enabled: true } })
    logActivity({ userId: user.id, userName: user.display_name, action: 'update', entityType: 'auth', description: 'เปิดใช้งาน 2FA' })

    return reply.send({ ok: true })
  })

  // DELETE /api/auth/2fa — disable 2FA (requires password)
  const disable2faSchema = z.object({ password: z.string().min(1) })

  app.delete('/auth/2fa', { schema: { body: disable2faSchema }, preHandler: [requireAuth] }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub } })
    if (!user) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' })

    const valid = await verifyPassword(request.body.password, user.password_hash)
    if (!valid) return reply.code(401).send({ error: 'รหัสผ่านไม่ถูกต้อง' })

    await prisma.user.update({
      where: { id: user.id },
      data: { totp_enabled: false, totp_secret: null, backup_codes: { set: null } as never },
    })
    logActivity({ userId: user.id, userName: user.display_name, action: 'update', entityType: 'auth', description: 'ปิดใช้งาน 2FA' })

    return reply.send({ ok: true })
  })

  // POST /api/auth/reset-password/request — admin generates reset link for a user
  const resetRequestSchema = z.object({ user_id: z.string().uuid() })

  app.post('/auth/reset-password/request', { schema: { body: resetRequestSchema }, preHandler: [requireAuth, requireRole('admin')] }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.body.user_id } })
    if (!user) return reply.code(404).send({ error: 'ไม่พบผู้ใช้' })

    const token = randomBytes(32).toString('hex')
    const expires = new Date()
    expires.setHours(expires.getHours() + RESET_TOKEN_EXPIRY_HOURS)

    await prisma.user.update({
      where: { id: user.id },
      data: { password_reset_token: token, password_reset_expires: expires },
    })

    logActivity({ userId: request.user.sub, userName: request.user.username, action: 'create', entityType: 'auth', entityId: user.id, description: `สร้าง reset link สำหรับ "${user.display_name}"` })

    return reply.send({ token, expires_at: expires.toISOString() })
  })

  // POST /api/auth/reset-password/confirm — public: set new password via token
  const resetConfirmSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
  })

  app.post('/auth/reset-password/confirm', { schema: { body: resetConfirmSchema } }, async (request, reply) => {
    const { token, password } = request.body

    const user = await prisma.user.findUnique({ where: { password_reset_token: token } })
    if (!user) return reply.code(404).send({ error: 'ลิงก์ไม่ถูกต้อง' })
    if (!user.password_reset_expires || user.password_reset_expires < new Date()) {
      return reply.code(410).send({ error: 'ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่จากผู้ดูแลระบบ' })
    }

    const password_hash = await hashPassword(password)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        password_reset_token: null,
        password_reset_expires: null,
        failed_login_attempts: 0,
        locked_until: null,
      },
    })

    logActivity({ userId: user.id, userName: user.display_name, action: 'update', entityType: 'auth', description: 'รีเซ็ตรหัสผ่านสำเร็จ' })

    return reply.send({ ok: true })
  })

  // POST /api/auth/logout
  app.post('/auth/logout', async (_request, reply) => {
    return reply.send({ ok: true })
  })
}
