import { X, Filter, ChevronDown } from 'lucide-react'
import { useFilter } from '../context/FilterContext'

const DEVICE_OPTIONS = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
]

const SOURCE_OPTIONS = [
  { value: 'direct', label: 'เข้าตรง' },
  { value: 'organic', label: 'ค้นหาทั่วไป' },
  { value: 'referral', label: 'ลิงก์อ้างอิง' },
  { value: 'social', label: 'โซเชียล' },
  { value: 'email', label: 'อีเมล' },
  { value: 'paid', label: 'โฆษณา' },
]

// Common country codes — user can type any 2-letter code
const COUNTRY_OPTIONS = [
  { value: 'TH', label: 'ไทย' },
  { value: 'US', label: 'สหรัฐฯ' },
  { value: 'GB', label: 'อังกฤษ' },
  { value: 'JP', label: 'ญี่ปุ่น' },
  { value: 'CN', label: 'จีน' },
  { value: 'IN', label: 'อินเดีย' },
  { value: 'DE', label: 'เยอรมนี' },
  { value: 'FR', label: 'ฝรั่งเศส' },
  { value: 'KR', label: 'เกาหลี' },
  { value: 'AU', label: 'ออสเตรเลีย' },
  { value: 'SG', label: 'สิงคโปร์' },
  { value: 'MY', label: 'มาเลเซีย' },
  { value: 'ID', label: 'อินโดนีเซีย' },
  { value: 'VN', label: 'เวียดนาม' },
  { value: 'BR', label: 'บราซิล' },
]

interface FilterSelectProps {
  label: string
  value: string | null
  options: { value: string; label: string }[]
  onChange: (value: string | null) => void
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="px-2.5 py-1 pr-7 rounded-lg text-xs font-medium appearance-none outline-none"
        style={{
          background: value ? 'var(--color-accent-blue)22' : 'var(--color-bg-surface)',
          border: `1px solid ${value ? 'var(--color-accent-blue)55' : 'var(--color-border)'}`,
          color: value ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
      >
        <option value="">{label}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown
        size={10}
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: value ? 'var(--color-accent-blue)' : 'var(--color-text-muted)' }}
      />
    </div>
  )
}

export function FilterBar() {
  const { filters, setFilter, clearFilters, hasActiveFilters } = useFilter()

  return (
    <div className="flex items-center gap-1.5">
      <Filter size={13} style={{ color: hasActiveFilters ? 'var(--color-accent-blue)' : 'var(--color-text-muted)' }} />

      <FilterSelect
        label="ประเทศ"
        value={filters.country}
        options={COUNTRY_OPTIONS}
        onChange={(v) => setFilter('country', v)}
      />
      <FilterSelect
        label="อุปกรณ์"
        value={filters.device}
        options={DEVICE_OPTIONS}
        onChange={(v) => setFilter('device', v)}
      />
      <FilterSelect
        label="แหล่งที่มา"
        value={filters.source}
        options={SOURCE_OPTIONS}
        onChange={(v) => setFilter('source', v)}
      />

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
          style={{ color: 'var(--color-accent-red)', background: 'var(--color-accent-red)11' }}
        >
          <X size={10} />
          ล้าง
        </button>
      )}
    </div>
  )
}
