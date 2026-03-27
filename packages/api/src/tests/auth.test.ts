import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock dependencies ────────────────────────────────────────────────────

vi.mock('../db/client.js', () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))
vi.mock('../db/redis.js', () => ({
  redis: { connect: vi.fn(), ping: vi.fn().mockResolvedValue('PONG') },
  redisSub: {},
}))
vi.mock('../services/buffer.js', () => ({ startFlushLoop: vi.fn(), pushToBuffer: vi.fn() }))
vi.mock('../services/sessionAggregator.js', () => ({ startSessionAggregator: vi.fn() }))
vi.mock('../services/activityLog.js', () => ({ logActivity: vi.fn() }))
vi.mock('../services/password.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('$2b$10$hashed'),
  verifyPassword: vi.fn(),
}))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import jwt from '@fastify/jwt'
import { authRoute } from '../routes/auth.js'
import { prisma } from '../db/client.js'
import { verifyPassword } from '../services/password.js'

const mockPrisma = prisma as unknown as {
  user: {
    count: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}
const mockVerifyPassword = verifyPassword as ReturnType<typeof vi.fn>

// ── Helpers ──────────────────────────────────────────────────────────────

const ADMIN_USER = {
  id: 'user-admin',
  username: 'admin',
  display_name: 'Admin',
  role: 'admin',
  password_hash: '$2b$10$hashed',
  created_at: new Date('2026-01-01'),
  last_login_at: null,
  access_token: 'magic-token-123',
}

const VIEWER_USER = {
  id: 'user-viewer',
  username: 'viewer',
  display_name: 'Viewer',
  role: 'viewer',
  password_hash: '$2b$10$hashed',
  created_at: new Date('2026-01-15'),
  last_login_at: null,
  access_token: null,
}

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(authRoute, { prefix: '/api' })
  await app.ready()
  return app
}

function adminToken(app: ReturnType<typeof Fastify>) {
  return app.jwt.sign({ sub: ADMIN_USER.id, username: ADMIN_USER.username, role: 'admin' })
}

function viewerToken(app: ReturnType<typeof Fastify>) {
  return app.jwt.sign({ sub: VIEWER_USER.id, username: VIEWER_USER.username, role: 'viewer' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Login ────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns JWT token for valid credentials', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER)
    mockVerifyPassword.mockResolvedValue(true)
    mockPrisma.user.update.mockResolvedValue(ADMIN_USER)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'correct-password' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(typeof body.token).toBe('string')
    expect(body.user).toHaveProperty('username', 'admin')
    expect(body.user).toHaveProperty('role', 'admin')
  })

  it('returns 401 for wrong password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER)
    mockVerifyPassword.mockResolvedValue(false)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'wrong-password' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for non-existent username', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: 'password' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns same error message for wrong user and wrong password (no enumeration)', async () => {
    // Wrong username
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const app = await buildApp()
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: 'pass' },
    })

    // Wrong password
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER)
    mockVerifyPassword.mockResolvedValue(false)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    })

    const body1 = JSON.parse(res1.body)
    const body2 = JSON.parse(res2.body)
    expect(body1.error).toBe(body2.error)
  })

  it('returns 400 for missing body fields', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for empty username', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: '', password: 'password' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('updates last_login_at on successful login', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER)
    mockVerifyPassword.mockResolvedValue(true)
    mockPrisma.user.update.mockResolvedValue(ADMIN_USER)

    const app = await buildApp()
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'correct' },
    })

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ADMIN_USER.id },
        data: expect.objectContaining({ last_login_at: expect.any(Date) }),
      }),
    )
  })
})

// ── Register ─────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('creates first user as admin without auth', async () => {
    mockPrisma.user.count.mockResolvedValue(0)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ ...ADMIN_USER, role: 'admin' })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'admin', password: 'password123', display_name: 'Admin User' },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('username', 'admin')
    expect(body).toHaveProperty('role', 'admin')
  })

  it('requires auth for subsequent user registration', async () => {
    mockPrisma.user.count.mockResolvedValue(1) // Users exist

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'newuser', password: 'password123', display_name: 'New User' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('requires admin role for subsequent registration', async () => {
    mockPrisma.user.count.mockResolvedValue(1)

    const app = await buildApp()
    const token = viewerToken(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'newuser', password: 'password123', display_name: 'New User' },
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(403)
  })

  it('allows admin to register new users', async () => {
    mockPrisma.user.count.mockResolvedValue(1)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ ...VIEWER_USER })

    const app = await buildApp()
    const token = adminToken(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'viewer', password: 'password123', display_name: 'Viewer' },
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(201)
  })

  it('returns 409 for duplicate username', async () => {
    mockPrisma.user.count.mockResolvedValue(0)
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER) // Already exists

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'admin', password: 'password123', display_name: 'Admin' },
    })

    expect(res.statusCode).toBe(409)
  })

  it('returns 400 for password shorter than 8 chars', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'user', password: 'short', display_name: 'User' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for missing display_name', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'user', password: 'password123' },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ── Token Login (Magic Link) ─────────────────────────────────────────────

describe('POST /api/auth/token-login', () => {
  it('returns JWT for valid access token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER)
    mockPrisma.user.update.mockResolvedValue(ADMIN_USER)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/token-login',
      payload: { token: 'magic-token-123' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(typeof body.token).toBe('string')
    expect(body.user).toHaveProperty('username', 'admin')
  })

  it('returns 401 for invalid access token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/token-login',
      payload: { token: 'invalid-token' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for missing token', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/token-login',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })
})

// ── GET /api/auth/me ─────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns user profile for authenticated user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER)

    const app = await buildApp()
    const token = adminToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('username', 'admin')
    expect(body).toHaveProperty('role', 'admin')
    expect(body).not.toHaveProperty('password_hash')
  })

  it('returns 401 without auth token', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 404 for deleted user with valid token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const app = await buildApp()
    const token = adminToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ── Logout ───────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns ok: true', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
  })
})
