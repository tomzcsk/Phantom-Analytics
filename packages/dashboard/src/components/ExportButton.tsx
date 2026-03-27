import { Download } from 'lucide-react'
import { arrayToCSV, downloadCSV } from '../lib/csv'
import { toastSuccess } from '../lib/toast'

interface ExportButtonProps {
  /** Column headers for the CSV. */
  headers: string[]
  /** Row data — each inner array must match headers length. */
  rows: unknown[][]
  /** Output filename (without .csv extension). */
  filename: string
  /** Disable the button (e.g. while data is loading or empty). */
  disabled?: boolean
}

export function ExportButton({ headers, rows, filename, disabled = false }: ExportButtonProps) {
  function handleClick() {
    const csv = arrayToCSV(headers, rows)
    downloadCSV(csv, `${filename}.csv`)
    void toastSuccess('ส่งออกสำเร็จ', `${rows.length} แถว`)
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title="ส่งออก CSV"
      className="p-2 rounded-lg transition-colors"
      style={{
        color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Download size={16} />
    </button>
  )
}
