import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client.js', () => ({
  prisma: {
    site: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userSite: {
      findMany: vi.fn(),
      create: vi.fn(),
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

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import jwt from '@fastify/jwt'
import { sitesRoute } from '../routes/sites.js'
import { prisma } from '../db/client.js'

const mockPrisma = prisma as unknown as {
  site: {
    findFirst: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  userSite: {
    findMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}

const ADMIN = { sub: 'user-1', username: 'admin', role: 'admin' }

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(sitesRoute, { prefix: '/api' })
  await app.ready()
  return app
}

function authHeader(app: ReturnType<typeof Fastify>) {
  return { authorization: `Bearer ${app.jwt.sign(ADMIN)}` }
}

const MOCK_SITE = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Site',
  domain: 'test.com',
  tracking_token: 'a'.repeat(64),
  created_at: new Date('2024-01-01'),
  deleted_at: null,
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/sites', () => {
  it('returns list of sites', async () => {
    mockPrisma.site.findMany.mockResolvedValue([MOCK_SITE])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/sites',
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as unknown[]
    expect(body).toHaveLength(1)
  })

  it('returns empty array when no sites exist', async () => {
    mockPrisma.site.findMany.mockResolvedValue([])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/sites',
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/sites',
    })

    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/sites', () => {
  it('creates a new site and returns 201', async () => {
    mockPrisma.site.findFirst.mockResolvedValue(null)
    mockPrisma.site.create.mockResolvedValue(MOCK_SITE)
    mockPrisma.userSite.create.mockResolvedValue({})

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: { name: 'Test Site', domain: 'test.com' },
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(201)
  })

  it('returns 409 if domain already exists', async () => {
    mockPrisma.site.findFirst.mockResolvedValue(MOCK_SITE)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: { name: 'Duplicate', domain: 'test.com' },
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(409)
  })

  it('returns 400 for missing name', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: { domain: 'test.com' },
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for missing domain', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: { name: 'Test Site' },
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: { name: 'Test', domain: 'test.com' },
    })

    expect(res.statusCode).toBe(401)
  })
})

describe('DELETE /api/sites/:id', () => {
  it('soft-deletes site and returns 200', async () => {
    mockPrisma.site.findUnique.mockResolvedValue(MOCK_SITE)
    mockPrisma.site.update.mockResolvedValue({ ...MOCK_SITE, deleted_at: new Date() })

    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/sites/${MOCK_SITE.id}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(204)
  })

  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/sites/${MOCK_SITE.id}`,
    })

    expect(res.statusCode).toBe(401)
  })
})
