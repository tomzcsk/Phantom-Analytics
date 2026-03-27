/**
 * CSV generation utility — RFC 4180 compliant, UTF-8 with BOM for Excel.
 */

const FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r'])

/** Escape a cell value per RFC 4180 + CSV injection guard. */
function escapeCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes('\t')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  // Guard against CSV injection: prefix dangerous chars with single quote
  if (str.length > 0 && FORMULA_PREFIXES.has(str[0]!)) {
    return `"'${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Convert headers + rows into a CSV string. */
export function arrayToCSV(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','))
  }
  return lines.join('\r\n')
}

/** Strip characters illegal in filenames across Windows/macOS/Linux. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 200)
}

/** Trigger a CSV file download in the browser. */
export function downloadCSV(csv: string, filename: string): void {
  // UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sanitizeFilename(filename)
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 10_000)
}
