import { useState, useEffect, useRef, useCallback } from 'react'
import type { RealtimePayload } from '@phantom/shared'
import { getToken } from '../lib/api'

interface UseRealtimeOptions {
  siteId: string
  /** How long to wait before reconnecting after a disconnect (ms). Default 3000. */
  reconnectDelay?: number
}

interface UseRealtimeResult {
  data: RealtimePayload | null
  connected: boolean
  reconnecting: boolean
  error: string | null
}

/**
 * SSE hook for real-time visitor data.
 *
 * Subscribes to GET /api/realtime/stream?site_id=<id>
 * Auto-reconnects on disconnect with exponential backoff.
 *
 * Per CLAUDE.md: SSE is the ONLY real-time mechanism. No long-polling fallback.
 * Redis Pub/Sub channel: site_<site_id>
 */
export function useRealtime({
  siteId,
  reconnectDelay = 3_000,
}: UseRealtimeOptions): UseRealtimeResult {
  const [data, setData] = useState<RealtimePayload | null>(null)
  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const esRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (!siteId) return

    esRef.current?.close()

    const token = getToken()
    const url = `/api/realtime/stream?site_id=${encodeURIComponent(siteId)}${token ? `&token=${encodeURIComponent(token)}` : ''}`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      setConnected(true)
      setReconnecting(false)
      setError(null)
      retryCountRef.current = 0
    }

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as RealtimePayload
        setData(payload)
      } catch {
        // Malformed SSE frame — ignore silently
      }
    }

    es.onerror = () => {
      setConnected(false)
      setReconnecting(true)
      es.close()

      // Exponential backoff: 3s, 6s, 12s, max 30s
      const backoff = Math.min(reconnectDelay * Math.pow(2, retryCountRef.current), 30_000)
      retryCountRef.current += 1

      reconnectTimerRef.current = setTimeout(() => {
        connect()
      }, backoff)
    }
  }, [siteId, reconnectDelay])

  useEffect(() => {
    connect()

    return () => {
      esRef.current?.close()
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
    }
  }, [connect])

  return { data, connected, reconnecting, error }
}
