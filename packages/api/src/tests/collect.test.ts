import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('../db/client.js', () => ({
  prisma: {
    site: {
      findFirst: vi.fn(),
    },
    event: {
      createMany: vi.fn(),
    },
  },
}))

vi.mock('../db/redis.js', () => ({
  redis: {
    rpush: vi.fn().mockResolvedValue(1),
    llen: vi.fn().mockResolvedValue(0),
    lrange: vi.fn().mockResolvedValue([]),
    ltrim: vi.fn().mockResolvedValue('OK'),
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    publish: vi.fn().mockResolvedValue(0),
  },
  redisSub: {
    subscribe: vi.fn(),
    on: vi.fn(),
    quit: vi.fn(),
    connect: vi.fn(),
  },
}))

vi.mock('../services/geo.js', () => ({
  lookupGeo: vi.fn().mockReturnValue({ country_code: 'US', region: 'CA' }),
}))

vi.mock('../services/ua.js', () => ({
  parseUA: vi.fn().mockReturnValue({
    is_bot: false,
    device_type: 'desktop',
    browser_name: 'Chrome',
    os_name: 'macOS',
  }),
}))

vi.mock('../services/realtime.js', () => ({
  publishRealtimeEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/buffer.js', () => ({
  pushToBuffer: vi.fn().mockResolvedValue(undefined),
  startFlushLoop: vi.fn(),
}))

vi.mock('../services/sessionAggregator.js', () => ({
  startSessionAggregator: vi.fn(),
}))

vi.mock('fastify-sse-v2', () => ({
  FastifySSEPlugin: async () => {},
}))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import jwt from '@fastify/jwt'
import { collectRoute } from '../routes/collect.js'
import { prisma } from '../db/client.js'

const mockPrisma = prisma as unknown as {
  site: { findFirst: ReturnType<typeof vi.fn> }
}

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(collectRoute, { prefix: '/api' })
  await app.ready()
  return app
}

describe('POST /api/collect', () => {
  const VALID_PAYLOAD = {
    site_id: '00000000-0000-0000-0000-000000000001',
    token: 'a'.repeat(64),
    session_id: 'abc123',
    event_type: 'pageview',
    url: 'https://example.com/test',
    timestamp: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 202 for valid payload with matching site+token', async () => {
    mockPrisma.site.findFirst.mockResolvedValue({ id: VALID_PAYLOAD.site_id })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: VALID_PAYLOAD,
    })

    expect(res.statusCode).toBe(202)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
  })

  it('returns 401 for invalid site_id/token', async () => {
    mockPrisma.site.findFirst.mockResolvedValue(null)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: VALID_PAYLOAD,
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for missing required fields', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: { site_id: 'not-a-uuid' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid event_type', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: { ...VALID_PAYLOAD, event_type: 'invalid_type' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 200 silently for bot user agents', async () => {
    const { parseUA } = await import('../services/ua.js')
    vi.mocked(parseUA).mockReturnValueOnce({
      is_bot: true,
      device_type: null,
      browser_name: null,
      browser_version: null,
      os_name: null,
      os_version: null,
    })
    mockPrisma.site.findFirst.mockResolvedValue({ id: VALID_PAYLOAD.site_id })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: VALID_PAYLOAD,
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
  })

  it('returns 400 for token that is not 64 chars', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      payload: { ...VALID_PAYLOAD, token: 'short' },
    })

    expect(res.statusCode).toBe(400)
  })
})
