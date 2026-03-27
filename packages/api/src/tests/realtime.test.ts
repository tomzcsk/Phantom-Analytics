import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client.js', () => ({
  prisma: {
    event: { findMany: vi.fn().mockResolvedValue([]) },
    userSite: { findUnique: vi.fn() },
  },
}))

vi.mock('../db/redis.js', () => ({
  redis: {
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    publish: vi.fn().mockResolvedValue(0),
  },
  redisSub: { subscribe: vi.fn(), on: vi.fn(), quit: vi.fn(), connect: vi.fn() },
}))

vi.mock('../services/buffer.js', () => ({ startFlushLoop: vi.fn(), pushToBuffer: vi.fn() }))
vi.mock('../services/sessionAggregator.js', () => ({ startSessionAggregator: vi.fn() }))

// Mock the realtime service's siteChannel
vi.mock('../services/realtime.js', () => ({
  siteChannel: vi.fn((siteId: string) => `site_${siteId}`),
  publishRealtimeEvent: vi.fn().mockResolvedValue(undefined),
}))

// Mock ioredis to prevent actual connections
vi.mock('ioredis', () => {
  const mockSub = {
    subscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
  }
  return { Redis: vi.fn().mockImplementation(() => mockSub) }
})

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import jwt from '@fastify/jwt'
import { realtimeRoute } from '../routes/realtime.js'
import { prisma } from '../db/client.js'

const mockPrisma = prisma as unknown as {
  userSite: { findUnique: ReturnType<typeof vi.fn> }
}

const SITE_ID = '00000000-0000-0000-0000-000000000001'
const ADMIN = { sub: 'user-1', username: 'admin', role: 'admin' }

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(realtimeRoute, { prefix: '/api' })
  await app.ready()
  return app
}

function authHeader(app: ReturnType<typeof Fastify>) {
  return { authorization: `Bearer ${app.jwt.sign(ADMIN)}` }
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/realtime/stream', () => {
  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/realtime/stream?site_id=${SITE_ID}`,
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for missing site_id', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/realtime/stream',
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid site_id format', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/realtime/stream?site_id=not-a-uuid',
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 403 for viewer without site access', async () => {
    mockPrisma.userSite.findUnique.mockResolvedValue(null)

    const app = await buildApp()
    const viewerToken = app.jwt.sign({ sub: 'v-1', username: 'viewer', role: 'viewer' })

    const res = await app.inject({
      method: 'GET',
      url: `/api/realtime/stream?site_id=${SITE_ID}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    })

    expect(res.statusCode).toBe(403)
  })

  // Note: SSE stream establishment test requires real Redis subscriber
  // which is impractical to mock. Auth and validation tests above cover
  // the HTTP layer; SSE behavior is best tested via E2E/integration tests.
})
