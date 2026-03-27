import { describe, it, expect, vi } from 'vitest'

vi.mock('../db/client.js', () => ({ prisma: {} }))
vi.mock('../db/redis.js', () => ({
  redis: { connect: vi.fn(), ping: vi.fn().mockResolvedValue('PONG') },
  redisSub: {},
}))
vi.mock('../services/buffer.js', () => ({ startFlushLoop: vi.fn(), pushToBuffer: vi.fn() }))
vi.mock('../services/sessionAggregator.js', () => ({ startSessionAggregator: vi.fn() }))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import jwt from '@fastify/jwt'
import { authRoute } from '../routes/auth.js'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(authRoute, { prefix: '/api' })
  await app.ready()
  return app
}

describe('POST /api/auth/login', () => {
  it('returns JWT token for valid credentials', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'secret' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { token: string; expires_in: string }
    expect(typeof body.token).toBe('string')
    expect(body.expires_in).toBe('24h')
  })

  it('returns 401 for wrong password', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for wrong username', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'hacker', password: 'secret' },
    })

    expect(res.statusCode).toBe(401)
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
})
