/**
 * Phantom Analytics Tracker
 *
 * Lightweight event tracker (target: < 5KB gzipped).
 * - No cookies, no localStorage — fingerprint-based sessions
 * - GDPR-friendly by design (respects DNT)
 * - Works in SPAs via History API patching
 * - Offline-resilient: queues events and retries on reconnect
 *
 * Usage:
 *   <script src="/tracker.js" data-site-id="YOUR_SITE_ID" async></script>
 */

// ── Types ──────────────────────────────────────────────────────────────────

interface PhantomConfig {
  siteId: string
  token: string
  endpoint: string
}

interface TrackPayload {
  site_id: string
  session_id: string
  event_type: 'pageview' | 'event' | 'session_start' | 'session_end' | 'funnel_step' | 'scroll' | 'click'
  url: string
  referrer?: string
  title?: string
  screen_width?: number
  screen_height?: number
  language?: string
  timezone?: string
  time_on_page?: number
  custom_name?: string
  custom_properties?: Record<string, unknown>
  timestamp: string
}

interface PhantomAPI {
  track: (name: string, properties?: Record<string, unknown>) => void
  pageview: () => void
}

// ── Globals ────────────────────────────────────────────────────────────────
// Extend Window in global-script context (no import/export, so no declare global needed)

interface Window {
  phantom: PhantomAPI
}

// ── Bootstrap ─────────────────────────────────────────────────────────────

;(function () {
  'use strict'

  // E2-F7: Respect Do Not Track — check both navigator and window variants
  // for maximum cross-browser compatibility. Silently bail if set.
  const dnt = navigator.doNotTrack ?? (window as Window & { doNotTrack?: string }).doNotTrack
  if (dnt === '1' || dnt === 'yes') return

  // Read config from: 1) window.__phantom_config (set before script load)
  // 2) currentScript dataset  3) querySelector fallback
  const wc = (window as Window & { __phantom_config?: { siteId?: string; token?: string; endpoint?: string } }).__phantom_config
  const script = (document.currentScript as HTMLScriptElement | null)
    ?? document.querySelector('script[data-site-id]') as HTMLScriptElement | null
  const siteId = wc?.siteId ?? script?.dataset['siteId'] ?? ''
  const token = wc?.token ?? script?.dataset['token'] ?? ''
  const endpoint =
    wc?.endpoint ?? script?.dataset['endpoint'] ?? `${window.location.origin}/api/collect`

  // Both site ID and token are required for event authentication (E9-F2)
  if (!siteId || !token) return

  const config: PhantomConfig = { siteId, token, endpoint }

  // ── E2-F4: Fingerprint-based session ID ───────────────────────────────────
  //
  // No cookies, no localStorage. Fingerprint is derived from stable browser
  // signals + a per-session nonce. The nonce resets when the session expires,
  // producing a new hash without storing anything.
  //
  // Session lifetime: 30 minutes of inactivity (in-memory timer).
  // Tab close also starts a new session (nonce is only in memory).

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000

  // Persist nonce in sessionStorage so refreshes keep the same session.
  // sessionStorage is tab-scoped, cleared on tab close — no GDPR concern.
  const NONCE_KEY = '__pa_n'
  let sessionNonce = (() => {
    try {
      const stored = sessionStorage.getItem(NONCE_KEY)
      if (stored) return stored
      const n = Math.random().toString(36).slice(2)
      sessionStorage.setItem(NONCE_KEY, n)
      return n
    } catch {
      return Math.random().toString(36).slice(2)
    }
  })()
  let lastActivityAt = Date.now()
  let cachedSessionId: string | null = null

  async function fingerprint(nonce: string): Promise<string> {
    const raw = [
      screen.width,
      screen.height,
      navigator.userAgent,
      navigator.language,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      nonce,
    ].join('|')

    const data = new TextEncoder().encode(raw)
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32) // 128-bit — sufficient for anonymous session uniqueness
  }

  async function getSessionId(): Promise<string> {
    const now = Date.now()

    // Reset session after 30 minutes of inactivity
    if (cachedSessionId && now - lastActivityAt > SESSION_TIMEOUT_MS) {
      sessionNonce = Math.random().toString(36).slice(2)
      try { sessionStorage.setItem(NONCE_KEY, sessionNonce) } catch { /* private mode */ }
      cachedSessionId = null
    }

    lastActivityAt = now

    if (!cachedSessionId) {
      cachedSessionId = await fingerprint(sessionNonce)
    }

    return cachedSessionId
  }

  // ── E2-F6: Offline event queue ────────────────────────────────────────────
  //
  // If the network is unavailable, serialized payloads are held in memory.
  // When the browser comes back online, the queue drains sequentially.
  // Queue is capped at 50 events to bound memory usage.

  const QUEUE_LIMIT = 50
  const offlineQueue: string[] = []

  function dispatchPayload(body: string): void {
    void fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      if (offlineQueue.length < QUEUE_LIMIT) offlineQueue.push(body)
    })
  }

  window.addEventListener('online', () => {
    const pending = offlineQueue.splice(0)
    pending.forEach(dispatchPayload)
  })

  // ── Core send ─────────────────────────────────────────────────────────────

  async function send(payload: Omit<TrackPayload, 'session_id'>): Promise<void> {
    const session_id = await getSessionId()
    // Include token in every payload for E9-F2 server-side validation
    const body = JSON.stringify({ ...payload, session_id, token: config.token })

    if (!navigator.onLine) {
      if (offlineQueue.length < QUEUE_LIMIT) offlineQueue.push(body)
      return
    }

    dispatchPayload(body)
  }

  // ── E2-F2: Pageview auto-capture ──────────────────────────────────────────

  let pageEnteredAt = Date.now()

  function trackPageview(): void {
    pageEnteredAt = Date.now()

    // Cast: Zod-style optional `T | undefined` vs exactOptionalPropertyTypes `T?`
    void send({
      site_id: config.siteId,
      event_type: 'pageview',
      url: window.location.href,
      referrer: document.referrer || undefined,
      title: document.title || undefined,
      screen_width: screen.width,
      screen_height: screen.height,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString(),
    } as Omit<TrackPayload, 'session_id'>)
  }

  // ── E2-F5: Page exit via sendBeacon ──────────────────────────────────────
  // (Handled by sendTimeOnPage + sendScrollDepth in onNavigate/onExit)

  // ── E2-F3: SPA History API patching ──────────────────────────────────────
  //
  // Patches pushState and replaceState to detect client-side navigation.
  // Works with React Router, Next.js App Router, Nuxt, Remix, and any
  // framework that uses the History API.
  //
  // Guard: compare URL before/after to avoid double-firing on hard reloads
  // (where pushState is not called, only the initial pageview fires).

  let lastUrl = window.location.href

  function sendTimeOnPage(): void {
    const time_on_page = Math.round((Date.now() - pageEnteredAt) / 1000)
    if (time_on_page <= 0) return
    void send({
      site_id: config.siteId,
      event_type: 'session_end',
      url: lastUrl,
      time_on_page,
      timestamp: new Date().toISOString(),
    } as Omit<TrackPayload, 'session_id'>)
  }

  function onNavigate(): void {
    const current = window.location.href
    if (current !== lastUrl) {
      sendTimeOnPage()
      sendScrollDepth()
      maxScrollDepth = 0
      lastUrl = current
      trackPageview()
    }
  }

  const _push = history.pushState.bind(history)
  const _replace = history.replaceState.bind(history)

  history.pushState = function (...args) {
    _push(...args)
    onNavigate()
  }

  history.replaceState = function (...args) {
    _replace(...args)
    onNavigate()
  }

  window.addEventListener('popstate', onNavigate)

  // ── E2-F6: Custom event public API ───────────────────────────────────────
  //
  // window.phantom.track(eventName, properties?)
  //
  // Example:
  //   phantom.track('signup', { plan: 'pro', source: 'hero_cta' })

  window.phantom = {
    track(name: string, properties?: Record<string, unknown>): void {
      void send({
        site_id: config.siteId,
        event_type: 'event',
        url: window.location.href,
        custom_name: name,
        custom_properties: properties,
        timestamp: new Date().toISOString(),
      } as Omit<TrackPayload, 'session_id'>)
    },
    pageview(): void {
      trackPageview()
    },
  }

  // ── Scroll Depth Tracking ────────────────────────────────────────────────
  //
  // Tracks the maximum scroll depth reached on the page.
  // Sends a single scroll event on page exit with the final depth (0–100).
  // 0 means the user entered but never scrolled.
  // Pages shorter than the viewport are skipped (no meaningful scroll).
  // Resets on SPA navigation.

  let scrollTicking = false

  // ── Click Tracking (opt-in) ─────────────────────────────────────────────
  //
  // Only elements (or their ancestors) with `data-pa-click` are tracked.
  // Uses event delegation on document for a single, lightweight listener.

  document.addEventListener('click', (e: MouseEvent) => {
    const target = (e.target as Element)?.closest?.('[data-pa-click]')
    if (!target) return

    const name = target.getAttribute('data-pa-click') ?? ''
    if (!name) return

    void send({
      site_id: config.siteId,
      event_type: 'click',
      url: window.location.href,
      custom_name: name,
      custom_properties: { element_id: name },
      timestamp: new Date().toISOString(),
    } as Omit<TrackPayload, 'session_id'>)
  })

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  // E2-F2: Fire initial pageview
  // Track max scroll depth reached, send on page exit.
  // 0 = entered but never scrolled.
  let maxScrollDepth = 0

  function updateMaxScroll(): void {
    const docHeight = document.documentElement.scrollHeight
    const viewHeight = window.innerHeight
    if (docHeight <= viewHeight) return // no scrollbar — not meaningful
    const depth = Math.min(100, Math.round(((window.scrollY + viewHeight) / docHeight) * 100))
    if (depth > maxScrollDepth) maxScrollDepth = depth
  }

  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      scrollTicking = true
      requestAnimationFrame(() => {
        updateMaxScroll()
        scrollTicking = false
      })
    }
  }, { passive: true })

  function sendScrollDepth(): void {
    void send({
      site_id: config.siteId,
      event_type: 'scroll',
      url: window.location.href,
      custom_name: 'scroll_depth',
      custom_properties: { depth: maxScrollDepth },
      timestamp: new Date().toISOString(),
    } as Omit<TrackPayload, 'session_id'>)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { trackPageview() })
  } else {
    trackPageview()
  }

  // E2-F5: Fire exit on unload — send time on page + scroll depth
  function onExit() { sendTimeOnPage(); sendScrollDepth() }
  window.addEventListener('pagehide', onExit)
  window.addEventListener('beforeunload', onExit)
})()
