import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, MousePointerClick, Globe, Filter, GitBranch, ChevronDown, Plus, Settings, LogOut, Users, ScrollText, Target, Search, Megaphone, Bell } from 'lucide-react'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { apiPost } from '../lib/api'
import { toastSuccess, toastError } from '../lib/toast'
import { FormModal } from './FormModal'

const NAV_ITEMS = [
  { to: '/overview', icon: LayoutDashboard, label: 'ภาพรวม' },
  { to: '/pages', icon: FileText, label: 'หน้าเว็บ' },
  { to: '/engagement', icon: MousePointerClick, label: 'พฤติกรรมผู้ใช้' },
  { to: '/sources', icon: Globe, label: 'แหล่งที่มา' },
  { to: '/funnels', icon: Filter, label: 'ช่องทาง' },
  { to: '/journeys', icon: GitBranch, label: 'เส้นทาง' },
  { to: '/goals', icon: Target, label: 'เป้าหมาย' },
  { to: '/events', icon: Search, label: 'Event Explorer' },
  { to: '/notifications', icon: Bell, label: 'แจ้งเตือน' },
  { to: '/campaigns', icon: Megaphone, label: 'แคมเปญ' },
] as const

function AddSiteModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await apiPost('/sites', { name, domain })
      onAdded()
      onClose()
      void toastSuccess('สร้างเว็บไซต์สำเร็จ')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      void toastError('สร้างเว็บไซต์ไม่สำเร็จ', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal open title="เพิ่มเว็บไซต์" onClose={onClose} width="w-80">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>ชื่อเว็บไซต์</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="เว็บไซต์ของฉัน"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>โดเมน</label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
            placeholder="example.com"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--color-accent-red)' }}>{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'กำลังสร้าง…' : 'สร้างเว็บไซต์'}
        </button>
      </form>
    </FormModal>
  )
}

export function Sidebar() {
  const { sites, activeSite, setActiveSiteId, refetch } = useSite()
  const { user, isAdmin, isDeveloper, logout } = useAuth()
  const [showAddSite, setShowAddSite] = useState(false)

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col border-r"
      style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-2.5 px-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <img src="/logo.png" alt="Phantom Analytics" className="w-8 h-8 rounded-lg" />
        <div className="flex">
          <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-accent-blue)' }}>
            Phantom
          </span>
          <span className="text-lg font-semibold tracking-tight ml-1" style={{ color: 'var(--color-text-primary)' }}>
            Analytics
          </span>
        </div>
      </div>

      {/* Site switcher + Add Site */}
      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {sites.length > 0 && (
          <div className="relative mb-2">
            <select
              value={activeSite?.id ?? ''}
              onChange={(e) => setActiveSiteId(e.target.value)}
              className="w-full appearance-none rounded-lg px-3 py-2 pr-8 text-sm font-medium"
              style={{
                background: 'var(--color-accent-blue)',
                color: '#fff',
                border: '1px solid var(--color-accent-blue)',
                opacity: 0.85,
              }}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id} style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                  {s.domain}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: '#fff' }}
            />
          </div>
        )}
        {isAdmin && (
          <button
            onClick={() => setShowAddSite(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
            style={{ color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border)', background: 'transparent' }}
          >
            <Plus size={12} />
            เพิ่มเว็บไซต์
          </button>
        )}
      </div>

      {showAddSite && (
        <AddSiteModal onClose={() => setShowAddSite(false)} onAdded={refetch} />
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'text-white' : 'hover:text-white',
              ].join(' ')
            }
            style={({ isActive }) => ({
              background: isActive ? 'var(--color-bg-surface)' : 'transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t pt-4 space-y-1" style={{ borderColor: 'var(--color-border)' }}>
        {isDeveloper && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'text-white' : 'hover:text-white',
              ].join(' ')
            }
            style={({ isActive }) => ({
              background: isActive ? 'var(--color-bg-surface)' : 'transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            })}
          >
            <Settings size={16} />
            ตั้งค่า
          </NavLink>
        )}
        {isAdmin && (
          <NavLink
            to="/users"
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'text-white' : 'hover:text-white',
              ].join(' ')
            }
            style={({ isActive }) => ({
              background: isActive ? 'var(--color-bg-surface)' : 'transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            })}
          >
            <Users size={16} />
            จัดการผู้ใช้
          </NavLink>
        )}
        {isAdmin && (
          <NavLink
            to="/activity-log"
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'text-white' : 'hover:text-white',
              ].join(' ')
            }
            style={({ isActive }) => ({
              background: isActive ? 'var(--color-bg-surface)' : 'transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            })}
          >
            <ScrollText size={16} />
            Activity Log
          </NavLink>
        )}

        {/* User info */}
        {user && (
          <div className="px-3 pt-3 mt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {user.display_name}
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0"
                style={{
                  background: user.role === 'admin'
                    ? 'var(--color-accent-blue)'
                    : user.role === 'developer'
                      ? 'var(--color-accent-purple)'
                      : 'var(--color-bg-surface)',
                  color: user.role === 'admin' || user.role === 'developer' ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {user.role}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-0 py-1 text-xs transition-colors hover:opacity-80"
              style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none' }}
            >
              <LogOut size={12} />
              ออกจากระบบ
            </button>
          </div>
        )}

        <p className="text-xs px-3 pt-2" style={{ color: 'var(--color-text-muted)' }}>
          v2.0.0 · โฮสต์ด้วยตัวเอง
        </p>
      </div>
    </aside>
  )
}
