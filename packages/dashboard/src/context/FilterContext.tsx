import { createContext, useContext, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface Filters {
  country: string | null
  device: string | null
  source: string | null
}

interface FilterContextValue {
  filters: Filters
  setFilter: (key: keyof Filters, value: string | null) => void
  clearFilters: () => void
  hasActiveFilters: boolean
  /** Append filter params to an API query string */
  filterParams: string
}

const FilterContext = createContext<FilterContextValue | null>(null)

const FILTER_KEYS = ['country', 'device', 'source'] as const

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters: Filters = useMemo(() => ({
    country: searchParams.get('country'),
    device: searchParams.get('device'),
    source: searchParams.get('source'),
  }), [searchParams])

  const hasActiveFilters = filters.country !== null || filters.device !== null || filters.source !== null

  const filterParams = useMemo(() => {
    const parts: string[] = []
    if (filters.country) parts.push(`filter_country=${encodeURIComponent(filters.country)}`)
    if (filters.device) parts.push(`filter_device=${encodeURIComponent(filters.device)}`)
    if (filters.source) parts.push(`filter_source=${encodeURIComponent(filters.source)}`)
    return parts.length > 0 ? '&' + parts.join('&') : ''
  }, [filters])

  function setFilter(key: keyof Filters, value: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  function clearFilters() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const key of FILTER_KEYS) {
        next.delete(key)
      }
      return next
    })
  }

  return (
    <FilterContext.Provider value={{ filters, setFilter, clearFilters, hasActiveFilters, filterParams }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilter() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilter must be used within FilterProvider')
  return ctx
}
