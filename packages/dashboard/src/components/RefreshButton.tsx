import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

interface RefreshButtonProps {
  loading?: boolean
  /** For non-React-Query pages: call this instead of invalidateQueries */
  onRefresh?: () => void
}

export function RefreshButton({ loading = false, onRefresh }: RefreshButtonProps) {
  const qc = useQueryClient()
  const [cooldown, setCooldown] = useState(false)

  // Reset cooldown when loading finishes
  useEffect(() => {
    if (!loading) setCooldown(false)
  }, [loading])

  const handleClick = useCallback(() => {
    if (cooldown || loading) return
    setCooldown(true)
    if (onRefresh) {
      onRefresh()
    } else {
      void qc.invalidateQueries()
    }
    // Fallback cooldown reset after 2s (in case loading never fires)
    setTimeout(() => setCooldown(false), 2000)
  }, [cooldown, loading, onRefresh, qc])

  return (
    <button
      onClick={handleClick}
      disabled={cooldown || loading}
      title="รีโหลดข้อมูล"
      className="p-2 rounded-lg transition-colors"
      style={{
        color: loading ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
        background: 'transparent',
        cursor: cooldown || loading ? 'not-allowed' : 'pointer',
        opacity: cooldown && !loading ? 0.5 : 1,
      }}
    >
      <RefreshCw
        size={16}
        className={loading ? 'animate-spin' : ''}
        style={{ animationDuration: loading ? '0.8s' : undefined }}
      />
    </button>
  )
}
