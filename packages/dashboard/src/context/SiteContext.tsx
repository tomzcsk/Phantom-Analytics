import { createContext, useContext, useState, useEffect } from 'react'
import { apiGet, getToken } from '../lib/api'

export interface Site {
  id: string
  name: string
  domain: string
  tracking_token: string
  data_retention_days: number | null
  created_at: string
}

interface SiteContextValue {
  sites: Site[]
  activeSite: Site | null
  setActiveSiteId: (id: string) => void
  loading: boolean
  refetch: () => void
}

const SiteContext = createContext<SiteContextValue | null>(null)

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites] = useState<Site[]>([])
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }

    const ac = new AbortController()
    setLoading(true)
    apiGet<Site[]>('/sites', { signal: ac.signal })
      .then((data) => {
        setSites(data)
        setActiveSiteId((prev) => {
          if (prev && data.some((s) => s.id === prev)) return prev
          return data[0]?.id ?? null
        })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error(err)
      })
      .finally(() => setLoading(false))

    return () => ac.abort()
  }, [tick])

  const activeSite = sites.find((s) => s.id === activeSiteId) ?? null

  return (
    <SiteContext.Provider
      value={{ sites, activeSite, setActiveSiteId, loading, refetch: () => setTick((t) => t + 1) }}
    >
      {children}
    </SiteContext.Provider>
  )
}

export function useSite() {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('useSite must be used within SiteProvider')
  return ctx
}
