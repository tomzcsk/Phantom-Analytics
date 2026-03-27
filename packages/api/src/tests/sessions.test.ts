import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client.js', () => ({
  prisma: {
    session: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    event: {
      findMany: vi.fn(),
    },
    userSite: { findUnique: vi.fn() },
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
import { sessionsRoute } from '../routes/sessions.js'
import { prisma } from '../db/client.js'

const mockPrisma = prisma as unknown as {
  session: {
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
  }
  event: { findMany: ReturnType<typeof vi.fn> }
  userSite: { findUnique: ReturnType<typeof vi.fn> }
}

const SITE_ID = '00000000-0000-0000-0000-000000000001'
const SESSION_DB_ID = '00000000-0000-0000-0000-000000000055'
const ADMIN = { sub: 'user-1', username: 'admin', role: 'admin' }

const MOCK_SESSION = {
  id: SESSION_DB_ID,
  session_id: 'abc123hash',
  entry_page: '/home',
  exit_page: '/about',
  page_count: 3,
  duration_seconds: 120,
  is_bounce: false,
  started_at: new Date('2026-03-15T10:00:00Z'),
  ended_at: new Date('2026-03-15T10:02:00Z'),
}

const MOCK_BOUNCE_SESSION = {
  ...MOCK_SESSION,
  id: '00000000-0000-0000-0000-000000000056',
  page_count: 1,
  duration_seconds: 15,
  is_bounce: true,
  exit_page: '/home',
}

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(sessionsRoute, { prefix: '/api' })
  await app.ready()
  return app
}

function authHeader(app: ReturnType<typeof Fastify>) {
  return { authorization: `Bearer ${app.jwt.sign(ADMIN)}` }
}

function queryString(overrides: Record<string, string> = {}) {
  const defaults = { site_id: SITE_ID, from: '2026-03-01', to: '2026-03-31' }
  return new URLSearchParams({ ...defaults, ...overrides }).toString()
}

beforeEach(() => vi.clearAllMocks())

// ── GET /api/sessions ────────────────────────────────────────────────────

describe('GET /api/sessions', () => {
  it('returns list of sessions for a site', async () => {
    mockPrisma.session.findMany.mockResolvedValue([MOCK_SESSION, MOCK_BOUNCE_SESSION])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveLength(2)
    expect(body[0]).toHaveProperty('session_id')
    expect(body[0]).toHaveProperty('entry_page')
    expect(body[0]).toHaveProperty('exit_page')
    expect(body[0]).toHaveProperty('page_count')
    expect(body[0]).toHaveProperty('duration_seconds')
    expect(body[0]).toHaveProperty('is_bounce')
    expect(body[0]).toHaveProperty('started_at')
  })

  it('returns bounce sessions with is_bounce=true', async () => {
    mockPrisma.session.findMany.mockResolvedValue([MOCK_BOUNCE_SESSION])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions?${queryString()}`,
      headers: authHeader(app),
    })

    const body = JSON.parse(res.body)
    expect(body[0].is_bounce).toBe(true)
    expect(body[0].page_count).toBe(1)
  })

  it('returns empty array when no sessions', async () => {
    mockPrisma.session.findMany.mockResolvedValue([])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions?${queryString()}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('respects limit parameter', async () => {
    mockPrisma.session.findMany.mockResolvedValue([MOCK_SESSION])

    const app = await buildApp()
    await app.inject({
      method: 'GET',
      url: `/api/sessions?${queryString({ limit: '5' })}`,
      headers: authHeader(app),
    })

    expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    )
  })

  it('returns 400 for missing required params', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid date format', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions?${queryString({ from: 'invalid' })}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions?${queryString()}`,
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 403 for viewer without site access', async () => {
    mockPrisma.userSite.findUnique.mockResolvedValue(null)
    const app = await buildApp()
    const viewerToken = app.jwt.sign({ sub: 'v-1', username: 'viewer', role: 'viewer' })

    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions?${queryString()}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    })

    expect(res.statusCode).toBe(403)
  })
})

// ── GET /api/sessions/:id/events (Journey) ───────────────────────────────

describe('GET /api/sessions/:id/events', () => {
  it('returns ordered events for a session', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      site_id: SITE_ID,
      session_id: 'abc123hash',
    })
    mockPrisma.event.findMany.mockResolvedValue([
      { event_type: 'pageview', url: '/home', timestamp: new Date('2026-03-15T10:00:00Z') },
      { event_type: 'pageview', url: '/about', timestamp: new Date('2026-03-15T10:00:30Z') },
      { event_type: 'session_end', url: '/about', timestamp: new Date('2026-03-15T10:02:00Z') },
    ])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${SESSION_DB_ID}/events`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveLength(3)
    expect(body[0]).toHaveProperty('event_type', 'pageview')
    expect(body[0]).toHaveProperty('url', '/home')
    expect(body[0]).toHaveProperty('timestamp')
    // Verify chronological order
    expect(new Date(body[0].timestamp).getTime()).toBeLessThan(
      new Date(body[1].timestamp).getTime(),
    )
  })

  it('returns 404 for non-existent session', async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null)

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${SESSION_DB_ID}/events`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns empty events for session with no events', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      site_id: SITE_ID,
      session_id: 'abc123hash',
    })
    mockPrisma.event.findMany.mockResolvedValue([])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${SESSION_DB_ID}/events`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${SESSION_DB_ID}/events`,
    })

    expect(res.statusCode).toBe(401)
  })
})
