import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client.js', () => ({
  prisma: {
    site: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
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

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import jwt from '@fastify/jwt'
import { sitesRoute } from '../routes/sites.js'
import { prisma } from '../db/client.js'

const mockPrisma = prisma as unknown as {
  site: {
    findFirst: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(sitesRoute, { prefix: '/api' })
  await app.ready()
  return app
}

const MOCK_SITE = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Site',
  domain: 'test.com',
  tracking_token: 'a'.repeat(64),
  created_at: new Date('2024-01-01'),
}

describe('GET /api/sites', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of sites', async () => {
    mockPrisma.site.findMany.mockResolvedValue([MOCK_SITE])

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/sites' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as unknown[]
    expect(body).toHaveLength(1)
  })
})

describe('POST /api/sites', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new site and returns 201', async () => {
    mockPrisma.site.findFirst.mockResolvedValue(null) // no existing
    mockPrisma.site.create.mockResolvedValue(MOCK_SITE)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: { name: 'Test Site', domain: 'test.com' },
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
    })

    expect(res.statusCode).toBe(409)
  })
})
