import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db/client.js', () => ({
  prisma: {
    site: { findFirst: vi.fn() },
    funnel: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
import { funnelsRoute } from '../routes/funnels.js'
import { prisma } from '../db/client.js'

const mockPrisma = prisma as unknown as {
  site: { findFirst: ReturnType<typeof vi.fn> }
  funnel: {
    create: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
}

const SITE_ID = '00000000-0000-0000-0000-000000000001'
const FUNNEL_ID = '00000000-0000-0000-0000-000000000099'
const ADMIN = { sub: 'user-1', username: 'admin', role: 'admin' }
const VIEWER = { sub: 'user-2', username: 'viewer', role: 'viewer' }

const MOCK_STEPS = [
  { index: 0, label: 'Landing', type: 'page_url', value: '/home' },
  { index: 1, label: 'Signup', type: 'page_url', value: '/register' },
]

const MOCK_FUNNEL = {
  id: FUNNEL_ID,
  site_id: SITE_ID,
  name: 'Signup Funnel',
  steps: MOCK_STEPS,
  created_at: new Date('2026-03-01'),
}

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(funnelsRoute, { prefix: '/api' })
  await app.ready()
  return app
}

function authHeader(app: ReturnType<typeof Fastify>, user = ADMIN) {
  return { authorization: `Bearer ${app.jwt.sign(user)}` }
}

beforeEach(() => vi.clearAllMocks())

// ── POST /api/funnels ────────────────────────────────────────────────────

describe('POST /api/funnels', () => {
  it('creates funnel with valid steps and returns 201', async () => {
    mockPrisma.site.findFirst.mockResolvedValue({ id: SITE_ID })
    mockPrisma.funnel.create.mockResolvedValue(MOCK_FUNNEL)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/funnels',
      payload: { site_id: SITE_ID, name: 'Signup Funnel', steps: MOCK_STEPS },
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('name', 'Signup Funnel')
    expect(body.steps).toHaveLength(2)
  })

  it('returns 404 for non-existent site', async () => {
    mockPrisma.site.findFirst.mockResolvedValue(null)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/funnels',
      payload: { site_id: SITE_ID, name: 'Test', steps: MOCK_STEPS },
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for less than 2 steps', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/funnels',
      payload: { site_id: SITE_ID, name: 'Test', steps: [MOCK_STEPS[0]] },
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for more than 10 steps', async () => {
    const tooManySteps = Array.from({ length: 11 }, (_, i) => ({
      index: i, label: `Step ${i}`, type: 'page_url', value: `/step-${i}`,
    }))

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/funnels',
      payload: { site_id: SITE_ID, name: 'Test', steps: tooManySteps },
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 403 for viewer role', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/funnels',
      payload: { site_id: SITE_ID, name: 'Test', steps: MOCK_STEPS },
      headers: authHeader(app, VIEWER),
    })

    expect(res.statusCode).toBe(403)
  })

  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/funnels',
      payload: { site_id: SITE_ID, name: 'Test', steps: MOCK_STEPS },
    })

    expect(res.statusCode).toBe(401)
  })
})

// ── GET /api/funnels ─────────────────────────────────────────────────────

describe('GET /api/funnels', () => {
  it('returns list of funnels for a site', async () => {
    mockPrisma.funnel.findMany.mockResolvedValue([MOCK_FUNNEL])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/funnels?site_id=${SITE_ID}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveLength(1)
    expect(body[0]).toHaveProperty('name', 'Signup Funnel')
  })

  it('returns empty array when no funnels exist', async () => {
    mockPrisma.funnel.findMany.mockResolvedValue([])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/funnels?site_id=${SITE_ID}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('returns 400 for missing site_id', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/funnels',
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(400)
  })
})

// ── GET /api/funnels/:id ─────────────────────────────────────────────────

describe('GET /api/funnels/:id', () => {
  it('returns funnel by id', async () => {
    mockPrisma.funnel.findUnique.mockResolvedValue(MOCK_FUNNEL)

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/funnels/${FUNNEL_ID}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.id).toBe(FUNNEL_ID)
    expect(body.steps).toHaveLength(2)
  })

  it('returns 404 for non-existent funnel', async () => {
    mockPrisma.funnel.findUnique.mockResolvedValue(null)

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/api/funnels/${FUNNEL_ID}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(404)
  })
})

// ── PUT /api/funnels/:id ─────────────────────────────────────────────────

describe('PUT /api/funnels/:id', () => {
  it('updates funnel name and steps', async () => {
    mockPrisma.funnel.findUnique.mockResolvedValue(MOCK_FUNNEL)
    const updated = { ...MOCK_FUNNEL, name: 'Updated Funnel' }
    mockPrisma.funnel.update.mockResolvedValue(updated)

    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/funnels/${FUNNEL_ID}`,
      payload: { name: 'Updated Funnel' },
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).name).toBe('Updated Funnel')
  })

  it('returns 404 for non-existent funnel', async () => {
    mockPrisma.funnel.findUnique.mockResolvedValue(null)

    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/funnels/${FUNNEL_ID}`,
      payload: { name: 'Updated' },
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 403 for viewer role', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/funnels/${FUNNEL_ID}`,
      payload: { name: 'Updated' },
      headers: authHeader(app, VIEWER),
    })

    expect(res.statusCode).toBe(403)
  })
})

// ── DELETE /api/funnels/:id ──────────────────────────────────────────────

describe('DELETE /api/funnels/:id', () => {
  it('deletes funnel and returns 204', async () => {
    mockPrisma.funnel.findUnique
      .mockResolvedValueOnce({ id: FUNNEL_ID })
      .mockResolvedValueOnce(MOCK_FUNNEL)
    mockPrisma.funnel.delete.mockResolvedValue(MOCK_FUNNEL)

    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/funnels/${FUNNEL_ID}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(204)
  })

  it('returns 404 for non-existent funnel', async () => {
    mockPrisma.funnel.findUnique.mockResolvedValue(null)

    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/funnels/${FUNNEL_ID}`,
      headers: authHeader(app),
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 403 for viewer role', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/funnels/${FUNNEL_ID}`,
      headers: authHeader(app, VIEWER),
    })

    expect(res.statusCode).toBe(403)
  })

  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/funnels/${FUNNEL_ID}`,
    })

    expect(res.statusCode).toBe(401)
  })
})
