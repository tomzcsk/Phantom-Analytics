import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface FormModalProps {
  open: boolean
  title: string
  onClose: () => void
  width?: string
  children: React.ReactNode
}

export function FormModal({ open, title, onClose, width = 'w-96', children }: FormModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const wasOpen = useRef(false)

  useEffect(() => {
    if (!open) {
      wasOpen.current = false
      return
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', handleKey)
    // Auto-focus first input only when modal first opens
    if (!wasOpen.current) {
      wasOpen.current = true
      const input = contentRef.current?.querySelector<HTMLElement>('input, select, textarea')
      input?.focus()
    }
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        ref={contentRef}
        className={`${width} rounded-xl p-5`}
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
