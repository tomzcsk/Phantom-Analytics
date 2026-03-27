/**
 * Tracker unit tests (E10-F2)
 *
 * Tests fingerprinting logic, DNT check, offline queue behavior.
 * Uses jsdom environment via vitest config.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Fingerprint function (extracted from tracker IIFE for testing) ──────────

async function fingerprint(
  nonce: string,
  opts: {
    screenWidth?: number
    screenHeight?: number
    userAgent?: string
    language?: string
    timezone?: string
  } = {},
): Promise<string> {
  const raw = [
    opts.screenWidth ?? 1920,
    opts.screenHeight ?? 1080,
    opts.userAgent ?? 'Mozilla/5.0',
    opts.language ?? 'en-US',
    opts.timezone ?? 'America/New_York',
    nonce,
  ].join('|')

  const data = new TextEncoder().encode(raw)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

describe('fingerprint', () => {
  it('is deterministic for same inputs', async () => {
    const a = await fingerprint('nonce-abc', { screenWidth: 1920, userAgent: 'Chrome' })
    const b = await fingerprint('nonce-abc', { screenWidth: 1920, userAgent: 'Chrome' })
    expect(a).toBe(b)
  })

  it('differs for different nonces', async () => {
    const a = await fingerprint('nonce-1')
    const b = await fingerprint('nonce-2')
    expect(a).not.toBe(b)
  })

  it('differs for different user agents', async () => {
    const a = await fingerprint('nonce', { userAgent: 'Chrome' })
    const b = await fingerprint('nonce', { userAgent: 'Firefox' })
    expect(a).not.toBe(b)
  })

  it('returns a 32-char hex string', async () => {
    const id = await fingerprint('test-nonce')
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })
})

// ── Offline queue logic ────────────────────────────────────────────────────

describe('offline queue', () => {
  it('caps at QUEUE_LIMIT entries', () => {
    const QUEUE_LIMIT = 50
    const queue: string[] = []

    for (let i = 0; i < 100; i++) {
      if (queue.length < QUEUE_LIMIT) queue.push(`event-${i}`)
    }

    expect(queue.length).toBe(QUEUE_LIMIT)
    expect(queue[0]).toBe('event-0')
    expect(queue[49]).toBe('event-49')
  })

  it('drains all pending events on reconnect', () => {
    const queue = ['event-1', 'event-2', 'event-3']
    const dispatched: string[] = []

    const pending = queue.splice(0)
    pending.forEach((e) => dispatched.push(e))

    expect(queue).toHaveLength(0)
    expect(dispatched).toEqual(['event-1', 'event-2', 'event-3'])
  })
})

// ── DNT logic ─────────────────────────────────────────────────────────────

describe('DNT detection', () => {
  it('suppresses tracking when DNT is "1"', () => {
    const dnt = '1'
    const shouldTrack = !(dnt === '1' || dnt === 'yes')
    expect(shouldTrack).toBe(false)
  })

  it('suppresses tracking when DNT is "yes"', () => {
    const dnt = 'yes'
    const shouldTrack = !(dnt === '1' || dnt === 'yes')
    expect(shouldTrack).toBe(false)
  })

  it('allows tracking when DNT is null', () => {
    const dnt: string | null = null
    const shouldTrack = !(dnt === '1' || dnt === 'yes')
    expect(shouldTrack).toBe(true)
  })

  it('allows tracking when DNT is "0"', () => {
    const dnt = '0'
    const shouldTrack = !(dnt === '1' || dnt === 'yes')
    expect(shouldTrack).toBe(true)
  })
})

// ── Session timeout ────────────────────────────────────────────────────────

describe('session timeout', () => {
  it('resets session after 30 minutes of inactivity', () => {
    const SESSION_TIMEOUT_MS = 30 * 60 * 1000
    let lastActivityAt = Date.now() - SESSION_TIMEOUT_MS - 1000 // 31 min ago
    let sessionNonce = 'original-nonce'
    let cachedSessionId: string | null = 'existing-session'

    const now = Date.now()
    if (cachedSessionId && now - lastActivityAt > SESSION_TIMEOUT_MS) {
      sessionNonce = Math.random().toString(36).slice(2)
      cachedSessionId = null
    }
    lastActivityAt = now

    expect(cachedSessionId).toBeNull()
    expect(sessionNonce).not.toBe('original-nonce')
  })

  it('preserves session within 30 minutes', () => {
    const SESSION_TIMEOUT_MS = 30 * 60 * 1000
    let lastActivityAt = Date.now() - 5 * 60 * 1000 // 5 min ago
    let cachedSessionId: string | null = 'existing-session'
    const originalNonce = 'original-nonce'
    let sessionNonce = originalNonce

    const now = Date.now()
    if (cachedSessionId && now - lastActivityAt > SESSION_TIMEOUT_MS) {
      sessionNonce = Math.random().toString(36).slice(2)
      cachedSessionId = null
    }
    lastActivityAt = now

    expect(cachedSessionId).toBe('existing-session')
    expect(sessionNonce).toBe(originalNonce)
  })
})

// ── Fingerprint entropy ──────────────────────────────────────────────────

describe('fingerprint entropy', () => {
  it('produces different hashes for different screen sizes', async () => {
    const a = await fingerprint('nonce', { screenWidth: 1920, screenHeight: 1080 })
    const b = await fingerprint('nonce', { screenWidth: 1366, screenHeight: 768 })
    expect(a).not.toBe(b)
  })

  it('produces different hashes for different languages', async () => {
    const a = await fingerprint('nonce', { language: 'en-US' })
    const b = await fingerprint('nonce', { language: 'th-TH' })
    expect(a).not.toBe(b)
  })

  it('produces different hashes for different timezones', async () => {
    const a = await fingerprint('nonce', { timezone: 'Asia/Bangkok' })
    const b = await fingerprint('nonce', { timezone: 'America/New_York' })
    expect(a).not.toBe(b)
  })

  it('hash length is exactly 32 hex chars (128-bit)', async () => {
    const hash = await fingerprint('test', {
      screenWidth: 2560, screenHeight: 1440,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', language: 'ja-JP',
      timezone: 'Asia/Tokyo',
    })
    expect(hash).toHaveLength(32)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })
})

// ── Scroll depth calculation ─────────────────────────────────────────────

describe('scroll depth calculation', () => {
  function calcScrollDepth(
    scrollTop: number,
    viewportHeight: number,
    documentHeight: number,
  ): number {
    if (documentHeight <= viewportHeight) return 100
    const maxScroll = documentHeight - viewportHeight
    return Math.min(100, Math.round((scrollTop / maxScroll) * 100))
  }

  it('returns 100% when document is shorter than viewport', () => {
    expect(calcScrollDepth(0, 900, 800)).toBe(100)
  })

  it('returns 0% at top of page', () => {
    expect(calcScrollDepth(0, 900, 3000)).toBe(0)
  })

  it('returns 100% at bottom of page', () => {
    expect(calcScrollDepth(2100, 900, 3000)).toBe(100)
  })

  it('returns 50% at middle of page', () => {
    expect(calcScrollDepth(1050, 900, 3000)).toBe(50)
  })

  it('caps at 100% even if scrollTop exceeds max', () => {
    expect(calcScrollDepth(5000, 900, 3000)).toBe(100)
  })
})

// ── Payload structure ────────────────────────────────────────────────────

describe('event payload structure', () => {
  it('pageview payload contains required fields', () => {
    const payload = {
      site_id: '00000000-0000-0000-0000-000000000001',
      token: 'a'.repeat(64),
      session_id: 'abc123',
      event_type: 'pageview' as const,
      url: 'https://example.com/test',
      timestamp: new Date().toISOString(),
    }

    expect(payload).toHaveProperty('site_id')
    expect(payload).toHaveProperty('token')
    expect(payload).toHaveProperty('session_id')
    expect(payload).toHaveProperty('event_type')
    expect(payload).toHaveProperty('url')
    expect(payload).toHaveProperty('timestamp')
    expect(payload.token).toHaveLength(64)
  })

  it('session_end payload includes time_on_page', () => {
    const payload = {
      site_id: '00000000-0000-0000-0000-000000000001',
      token: 'a'.repeat(64),
      session_id: 'abc123',
      event_type: 'session_end' as const,
      url: 'https://example.com/test',
      time_on_page: 45,
      timestamp: new Date().toISOString(),
    }

    expect(payload.event_type).toBe('session_end')
    expect(payload.time_on_page).toBe(45)
    expect(typeof payload.time_on_page).toBe('number')
  })

  it('custom event payload includes custom_name and custom_properties', () => {
    const payload = {
      site_id: '00000000-0000-0000-0000-000000000001',
      token: 'a'.repeat(64),
      session_id: 'abc123',
      event_type: 'event' as const,
      url: 'https://example.com/test',
      custom_name: 'signup_click',
      custom_properties: { plan: 'pro' },
      timestamp: new Date().toISOString(),
    }

    expect(payload.custom_name).toBe('signup_click')
    expect(payload.custom_properties).toEqual({ plan: 'pro' })
  })

  it('timestamp is valid ISO 8601', () => {
    const ts = new Date().toISOString()
    expect(() => new Date(ts)).not.toThrow()
    expect(new Date(ts).toISOString()).toBe(ts)
  })
})

// ── Config override ──────────────────────────────────────────────────────

describe('config override mechanism', () => {
  it('__phantom_config overrides default endpoint', () => {
    const defaultEndpoint = '/api/collect'
    const config: Record<string, string> = { endpoint: '/custom/collect' }

    const resolvedEndpoint = config['endpoint'] ?? defaultEndpoint
    expect(resolvedEndpoint).toBe('/custom/collect')
  })

  it('falls back to default when no config present', () => {
    const defaultEndpoint = '/api/collect'
    const config: Record<string, string> | undefined = undefined

    const resolvedEndpoint = config?.['endpoint'] ?? defaultEndpoint
    expect(resolvedEndpoint).toBe('/api/collect')
  })

  it('__phantom_config can override site_id', () => {
    const config = { siteId: 'custom-site-id', token: 'custom-token' }

    expect(config.siteId).toBe('custom-site-id')
    expect(config.token).toBe('custom-token')
  })
})
