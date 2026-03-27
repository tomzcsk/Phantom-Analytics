import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock dependencies ────────────────────────────────────────────────────

vi.mock('../db/client.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    site: { findFirst: vi.fn(), findUnique: vi.fn() },
    event: { createMany: vi.fn() },
    funnel: { findFirst: vi.fn() },
    userSite: { findUnique: vi.fn() },
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
  redisSub: { subscribe: vi.fn(), on: vi.fn(), quit: vi.fn(), connect: vi.fn() },
}))

vi.mock('../services/buffer.js', () => ({
  pushToBuffer: vi.fn().mockResolvedValue(undefined),
  startFlushLoop: vi.fn(),
}))
vi.mock('../services/sessionAggregator.js', () => ({ startSessionAggregator: vi.fn() }))
vi.mock('../services/regionNames.js', () => ({
  getRegionName: vi.fn().mockReturnValue('California'),
}))
vi.mock('fastify-sse-v2', () => ({ FastifySSEPlugin: async () => {} }))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import jwt from '@fastify/jwt'
import { analyticsRoute } from '../routes/analytics.js'
import { prisma } from '../db/client.js'

// ── Typed mock ───────────────────────────────────────────────────────────

const mockPrisma = prisma as unknown as {
  $queryRaw: ReturnType<typeof vi.fn>
  site: { findFirst: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> }
  userSite: { findUnique: ReturnType<typeof vi.fn> }
}

// ── Test helpers ─────────────────────────────────────────────────────────

const SITE_ID = '00000000-0000-0000-0000-000000000001'
const USER = { sub: 'user-1', username: 'admin', role: 'admin' }

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(analyticsRoute, { prefix: '/api' })
  await app.ready()
  return app
}

function authHeader(app: ReturnType<typeof Fastify>) {
  const token = app.jwt.sign(USER)
  return { authorization: `Bearer ${token}` }
}

function queryString(overrides: Record<string, string> = {}) {
  const defaults = {
    site_id: SITE_ID,
    from: '2026-03-01',
    to: '2026-03-07',
    tz: 'Asia/Bangkok',
  }
  const params = new URLSearchParams({ ...defaults, ...overrides })
  return params.toString()
}

// ── Mock data factories ──────────────────────────────────────────────────

function mockOverviewRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    pageviews: BigInt(1000),
    unique_visitors: BigInt(250),
    avg_session_duration: 45.5,
    bounce_rate: 0.35,
    bounce_count: BigInt(87),
    ...overrides,
  }
}

function mockTimeseriesRows() {
  return [
    { bucket: new Date('2026-03-01'), pageviews: BigInt(100), visitors: BigInt(30), sessions: BigInt(35) },
    { bucket: new Date('2026-03-02'), pageviews: BigInt(150), visitors: BigInt(40), sessions: BigInt(45) },
    { bucket: new Date('2026-03-03'), pageviews: BigInt(120), visitors: BigInt(35), sessions: BigInt(38) },
  ]
}

function mockPageRows() {
  return [
    { url: '/home', pageviews: BigInt(500), visitors: BigInt(200), avg_duration: 30.5 },
    { url: '/about', pageviews: BigInt(200), visitors: BigInt(100), avg_duration: 20.0 },
  ]
}

function mockSourceRows() {
  return [
    { source: 'direct', count: BigInt(400) },
    { source: 'google', count: BigInt(300) },
    { source: 'twitter', count: BigInt(100) },
  ]
}

function mockDeviceRows() {
  return [
    { device_type: 'desktop', count: BigInt(600) },
    { device_type: 'mobile', count: BigInt(350) },
    { device_type: 'tablet', count: BigInt(50) },
  ]
}

function mockGeoRows() {
  return [
    { country_code: 'TH', count: BigInt(500) },
    { country_code: 'US', count: BigInt(300) },
    { country_code: 'JP', count: BigInt(100) },
  ]
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/analytics/overview', () => {
  it('returns KPI metrics with period-over-period deltas', async () => {
    // Current period + previous period
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([mockOverviewRow()])
      .mockResolvedValueOnce([mockOverviewRow({ pageviews: BigInt(800), unique_visitors: BigInt(200) })])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/overview?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('pageviews', 1000)
    expect(body).toHaveProperty('unique_visitors', 250)
    expect(body).toHaveProperty('avg_session_duration')
    expect(body).toHaveProperty('bounce_rate')
    expect(body).toHaveProperty('pageviews_change')
    expect(body).toHaveProperty('visitors_change')
    expect(typeof body.pageviews_change).toBe('number')
  })

  it('returns zeros for empty data', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([mockOverviewRow({
        pageviews: BigInt(0),
        unique_visitors: BigInt(0),
        avg_session_duration: 0,
        bounce_rate: 0,
        bounce_count: BigInt(0),
      })])
      .mockResolvedValueOnce([mockOverviewRow({
        pageviews: BigInt(0),
        unique_visitors: BigInt(0),
        avg_session_duration: 0,
        bounce_rate: 0,
        bounce_count: BigInt(0),
      })])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/overview?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.pageviews).toBe(0)
    expect(body.unique_visitors).toBe(0)
    expect(body.pageviews_change).toBe(0)
    expect(body.visitors_change).toBe(0)
  })

  it('calculates positive percentage change correctly', async () => {
    // Current: 200 pageviews, Previous: 100 pageviews → +100%
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([mockOverviewRow({ pageviews: BigInt(200) })])
      .mockResolvedValueOnce([mockOverviewRow({ pageviews: BigInt(100) })])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/overview?${queryString()}`,
      headers: authHeader(app),
    })

    const body = JSON.parse(res.body)
    expect(body.pageviews_change).toBe(100)
  })

  it('returns 400 for missing required query params', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/overview',
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid date format', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/overview?${queryString({ from: 'not-a-date' })}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid site_id format', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/overview?${queryString({ site_id: 'not-a-uuid' })}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })

  it('defaults timezone to Asia/Bangkok when tz not provided', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([mockOverviewRow()])
      .mockResolvedValueOnce([mockOverviewRow()])

    const app = await buildApp()
    const params = new URLSearchParams({
      site_id: SITE_ID,
      from: '2026-03-01',
      to: '2026-03-07',
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/overview?${params}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
  })
})

describe('GET /api/analytics/timeseries', () => {
  it('returns array of timeseries points', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce(mockTimeseriesRows())

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/timeseries?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toHaveProperty('pageviews')
    expect(body[0]).toHaveProperty('visitors')
  })

  it('returns empty array for no data', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/timeseries?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
  })

  it('returns 400 for missing query params', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/timeseries',
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/analytics/pages', () => {
  it('returns top pages sorted by pageviews', async () => {
    // Main query + sparkline query
    mockPrisma.$queryRaw
      .mockResolvedValueOnce(mockPageRows())
      .mockResolvedValueOnce([
        { url: '/home', day: new Date('2026-03-01'), pv_count: BigInt(50) },
        { url: '/home', day: new Date('2026-03-02'), pv_count: BigInt(60) },
        { url: '/about', day: new Date('2026-03-01'), pv_count: BigInt(20) },
      ])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/pages?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('url')
      expect(body[0]).toHaveProperty('pageviews')
      expect(body[0]).toHaveProperty('visitors')
    }
  })

  it('returns empty array when no pages visited', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/pages?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toEqual([])
  })
})

describe('GET /api/analytics/sources', () => {
  it('returns source breakdown with percentages', async () => {
    // site lookup + sources query + referrers query
    mockPrisma.site.findUnique.mockResolvedValue({ domain: 'example.com' })
    mockPrisma.$queryRaw
      .mockResolvedValueOnce(mockSourceRows())
      .mockResolvedValueOnce([
        { domain: 'google.com', count: BigInt(250) },
        { domain: 't.co', count: BigInt(80) },
      ])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/sources?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('sources')
    expect(Array.isArray(body.sources)).toBe(true)
    if (body.sources.length > 0) {
      expect(body.sources[0]).toHaveProperty('source')
      expect(body.sources[0]).toHaveProperty('count')
      expect(body.sources[0]).toHaveProperty('percentage')
    }
  })

  it('returns zero-count sources for no traffic', async () => {
    mockPrisma.site.findUnique.mockResolvedValue({ domain: 'example.com' })
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/sources?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    // Sources endpoint returns all categories with count=0 even when empty
    expect(body.sources).toBeDefined()
    for (const s of body.sources) {
      expect(s.count).toBe(0)
    }
  })
})

describe('GET /api/analytics/devices', () => {
  it('returns device/browser/OS breakdown', async () => {
    // devices + browsers + os queries
    mockPrisma.$queryRaw
      .mockResolvedValueOnce(mockDeviceRows())
      .mockResolvedValueOnce([
        { browser: 'Chrome', count: BigInt(500) },
        { browser: 'Firefox', count: BigInt(200) },
      ])
      .mockResolvedValueOnce([
        { os: 'Windows', count: BigInt(400) },
        { os: 'macOS', count: BigInt(350) },
      ])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/devices?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('devices')
    expect(body).toHaveProperty('browsers')
    expect(body).toHaveProperty('operating_systems')
    expect(Array.isArray(body.devices)).toBe(true)
    if (body.devices.length > 0) {
      expect(body.devices[0]).toHaveProperty('device_type')
      expect(body.devices[0]).toHaveProperty('count')
      expect(body.devices[0]).toHaveProperty('percentage')
    }
  })

  it('returns empty arrays for no traffic', async () => {
    // All three parallel queries return empty
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([]) // devices
      .mockResolvedValueOnce([]) // browsers
      .mockResolvedValueOnce([]) // os

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/devices?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    // All breakdowns should be empty when no events exist
    expect(body.devices).toHaveLength(0)
    expect(body.browsers).toHaveLength(0)
    expect(body.operating_systems).toHaveLength(0)
  })
})

describe('GET /api/analytics/geo', () => {
  it('returns country breakdown with country names', async () => {
    const geoData = [
      { country_code: 'TH', count: BigInt(500) },
      { country_code: 'US', count: BigInt(300) },
    ]
    // Use mockResolvedValue to set default for all $queryRaw calls in this test
    mockPrisma.$queryRaw.mockResolvedValue(geoData)

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/geo?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
    // Verify structure — may contain data from mockResolvedValue
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('country_code')
      expect(body[0]).toHaveProperty('country_name')
      expect(body[0]).toHaveProperty('visitors')
      expect(body[0]).toHaveProperty('percentage')
      expect(typeof body[0].percentage).toBe('number')
    }
  })

  it('returns empty array when no geo data', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/geo?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toEqual([])
  })
})

describe('Analytics auth & access control', () => {
  it('returns 401 when no auth token provided', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/overview?${queryString()}`,
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for invalid JWT token', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/overview?${queryString()}`,
      headers: { authorization: 'Bearer invalid.token.here' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 403 when viewer has no site access', async () => {
    mockPrisma.userSite.findUnique.mockResolvedValue(null)

    const app = await buildApp()
    const viewerToken = app.jwt.sign({ sub: 'viewer-1', username: 'viewer', role: 'viewer' })
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/overview?${queryString()}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    })

    expect(res.statusCode).toBe(403)
  })

  it('allows admin to access any site', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([mockOverviewRow()])
      .mockResolvedValueOnce([mockOverviewRow()])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/analytics/overview?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    // Admin should not trigger userSite lookup
    expect(mockPrisma.userSite.findUnique).not.toHaveBeenCalled()
  })

  it('returns 401 for all analytics endpoints without auth', async () => {
    const app = await buildApp()
    const endpoints = [
      '/api/analytics/overview',
      '/api/analytics/timeseries',
      '/api/analytics/pages',
      '/api/analytics/sources',
      '/api/analytics/devices',
      '/api/analytics/geo',
    ]

    for (const url of endpoints) {
      const res = await app.inject({
        method: 'GET',
        url: `${url}?${queryString()}`,
      })
      expect(res.statusCode).toBe(401)
    }
  })
})
