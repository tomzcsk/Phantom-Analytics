import { Copy } from 'lucide-react'
import { toastSuccess } from '../lib/toast'

interface CopyButtonProps {
  text: string
  size?: 'sm' | 'md'
}

export function CopyButton({ text, size = 'md' }: CopyButtonProps) {
  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      void toastSuccess('คัดลอกแล้ว!')
    })
  }

  const iconSize = size === 'sm' ? 10 : 12
  const className = size === 'sm'
    ? 'flex items-center gap-1 px-2 py-1 rounded text-xs'
    : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium'

  return (
    <button
      onClick={handleCopy}
      className={`${className} transition-colors`}
      style={{
        background: 'var(--color-bg-base)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border)',
      }}
    >
      <Copy size={iconSize} />
      คัดลอก
    </button>
  )
}
