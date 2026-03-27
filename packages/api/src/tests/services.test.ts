import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock dependencies ────────────────────────────────────────────────────

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

vi.mock('../db/client.js', () => ({
  prisma: {
    event: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    userSite: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}))

import { redis } from '../db/redis.js'
import { prisma } from '../db/client.js'
import { pushToBuffer, BUFFER_KEY } from '../services/buffer.js'
import { lookupGeo } from '../services/geo.js'
import { parseUA } from '../services/ua.js'
import { canAccessSite, getAccessibleSiteIds } from '../services/siteAccess.js'
import type { EnrichedEvent } from '@phantom/shared'

const mockRedis = redis as unknown as {
  rpush: ReturnType<typeof vi.fn>
  llen: ReturnType<typeof vi.fn>
  lrange: ReturnType<typeof vi.fn>
  ltrim: ReturnType<typeof vi.fn>
}

const mockPrisma = prisma as unknown as {
  event: { createMany: ReturnType<typeof vi.fn> }
  userSite: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Buffer Service ───────────────────────────────────────────────────────

describe('buffer service', () => {
  const sampleEvent: EnrichedEvent = {
    site_id: '00000000-0000-0000-0000-000000000001',
    session_id: 'session-abc',
    event_type: 'pageview',
    url: 'https://example.com/',
    timestamp: new Date().toISOString(),
    country_code: 'TH',
    region: '10',
    device_type: 'desktop',
    browser: 'Chrome',
    os: 'macOS',
  }

  describe('pushToBuffer', () => {
    it('pushes serialized event to Redis List', async () => {
      await pushToBuffer(sampleEvent)

      expect(mockRedis.rpush).toHaveBeenCalledWith(BUFFER_KEY, JSON.stringify(sampleEvent))
    })

    it('pushes event with null optional fields', async () => {
      const eventWithNulls: EnrichedEvent = {
        ...sampleEvent,
        referrer: undefined,
        title: undefined,
        country_code: null,
        region: null,
        device_type: null,
        browser: null,
        os: null,
      }

      await pushToBuffer(eventWithNulls)

      expect(mockRedis.rpush).toHaveBeenCalledTimes(1)
      const pushed = JSON.parse(mockRedis.rpush.mock.calls[0][1])
      expect(pushed.site_id).toBe(sampleEvent.site_id)
      expect(pushed.country_code).toBeNull()
    })

    it('handles custom properties in event', async () => {
      const eventWithProps: EnrichedEvent = {
        ...sampleEvent,
        custom_name: 'button_click',
        custom_properties: { button: 'signup', page: 'home' },
      }

      await pushToBuffer(eventWithProps)

      const pushed = JSON.parse(mockRedis.rpush.mock.calls[0][1])
      expect(pushed.custom_name).toBe('button_click')
      expect(pushed.custom_properties).toEqual({ button: 'signup', page: 'home' })
    })
  })
})

// ── GeoIP Service ────────────────────────────────────────────────────────

describe('geo service', () => {
  describe('lookupGeo', () => {
    it('returns country and region for valid public IP', () => {
      const result = lookupGeo('8.8.8.8')

      expect(result).toHaveProperty('country_code')
      expect(result).toHaveProperty('region')
      // Google DNS — should resolve to US
      expect(result.country_code).toBe('US')
    })

    it('returns nulls for private/local IP', () => {
      const result = lookupGeo('127.0.0.1')

      expect(result.country_code).toBeNull()
      expect(result.region).toBeNull()
    })

    it('returns nulls for empty string', () => {
      const result = lookupGeo('')

      expect(result.country_code).toBeNull()
      expect(result.region).toBeNull()
    })

    it('returns nulls for invalid IP format', () => {
      const result = lookupGeo('not-an-ip')

      expect(result.country_code).toBeNull()
      expect(result.region).toBeNull()
    })

    it('never throws regardless of input', () => {
      expect(() => lookupGeo('')).not.toThrow()
      expect(() => lookupGeo(':::invalid')).not.toThrow()
      expect(() => lookupGeo('999.999.999.999')).not.toThrow()
    })

    it('returns correct structure shape', () => {
      const result = lookupGeo('1.1.1.1')

      expect(typeof result).toBe('object')
      expect('country_code' in result).toBe(true)
      expect('region' in result).toBe(true)
    })
  })
})

// ── UA Parsing Service ───────────────────────────────────────────────────

describe('ua service', () => {
  describe('parseUA', () => {
    it('parses Chrome desktop UA correctly', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      const result = parseUA(ua)

      expect(result.is_bot).toBe(false)
      expect(result.device_type).toBe('desktop')
      expect(result.browser_name).toBe('Chrome')
      expect(result.os_name).toBe('Mac OS')
    })

    it('parses Firefox desktop UA correctly', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0'
      const result = parseUA(ua)

      expect(result.is_bot).toBe(false)
      expect(result.device_type).toBe('desktop')
      expect(result.browser_name).toBe('Firefox')
      expect(result.os_name).toBe('Windows')
    })

    it('parses mobile Safari UA as mobile device', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      const result = parseUA(ua)

      expect(result.is_bot).toBe(false)
      expect(result.device_type).toBe('mobile')
      expect(result.browser_name).toBe('Mobile Safari')
      expect(result.os_name).toBe('iOS')
    })

    it('parses tablet UA as tablet device', () => {
      const ua = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      const result = parseUA(ua)

      expect(result.is_bot).toBe(false)
      expect(result.device_type).toBe('tablet')
    })

    it('detects Googlebot as bot', () => {
      const ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      const result = parseUA(ua)

      expect(result.is_bot).toBe(true)
      expect(result.device_type).toBeNull()
      expect(result.browser_name).toBeNull()
      expect(result.os_name).toBeNull()
    })

    it('detects Bingbot as bot', () => {
      const ua = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
      const result = parseUA(ua)

      expect(result.is_bot).toBe(true)
    })

    it('returns null device_type for empty UA string', () => {
      const result = parseUA('')

      expect(result.is_bot).toBe(false)
      expect(result.device_type).toBeNull()
    })

    it('returns desktop for unrecognized non-bot UA', () => {
      const ua = 'Mozilla/5.0 (X11; Linux x86_64) SomeUnknownBrowser/1.0'
      const result = parseUA(ua)

      expect(result.is_bot).toBe(false)
      expect(result.device_type).toBe('desktop')
    })

    it('returns correct result shape for all inputs', () => {
      const result = parseUA('anything')

      expect(result).toHaveProperty('device_type')
      expect(result).toHaveProperty('browser_name')
      expect(result).toHaveProperty('browser_version')
      expect(result).toHaveProperty('os_name')
      expect(result).toHaveProperty('os_version')
      expect(result).toHaveProperty('is_bot')
    })
  })
})

// ── Site Access Service ──────────────────────────────────────────────────

describe('siteAccess service', () => {
  describe('canAccessSite', () => {
    it('always returns true for admin role', async () => {
      const result = await canAccessSite('user-1', 'admin', 'site-1')

      expect(result).toBe(true)
      // Admin should not query DB
      expect(mockPrisma.userSite.findUnique).not.toHaveBeenCalled()
    })

    it('returns true for viewer with site assignment', async () => {
      mockPrisma.userSite.findUnique.mockResolvedValue({ user_id: 'user-2', site_id: 'site-1' })

      const result = await canAccessSite('user-2', 'viewer', 'site-1')

      expect(result).toBe(true)
    })

    it('returns false for viewer without site assignment', async () => {
      mockPrisma.userSite.findUnique.mockResolvedValue(null)

      const result = await canAccessSite('user-2', 'viewer', 'site-999')

      expect(result).toBe(false)
    })
  })

  describe('getAccessibleSiteIds', () => {
    it('returns null for admin (all sites accessible)', async () => {
      const result = await getAccessibleSiteIds('user-1', 'admin')

      expect(result).toBeNull()
    })

    it('returns assigned site IDs for viewer', async () => {
      mockPrisma.userSite.findMany.mockResolvedValue([
        { site_id: 'site-1' },
        { site_id: 'site-2' },
      ])

      const result = await getAccessibleSiteIds('user-2', 'viewer')

      expect(result).toEqual(['site-1', 'site-2'])
    })

    it('returns empty array for viewer with no assignments', async () => {
      mockPrisma.userSite.findMany.mockResolvedValue([])

      const result = await getAccessibleSiteIds('user-3', 'viewer')

      expect(result).toEqual([])
    })
  })
})
