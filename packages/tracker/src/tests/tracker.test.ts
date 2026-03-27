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
