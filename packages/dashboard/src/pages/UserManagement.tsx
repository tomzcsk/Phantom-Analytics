import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, Trash2, Globe, Link, RefreshCw, ChevronDown } from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api'
import { toastSuccess, toastError } from '../lib/toast'
import { useAuth } from '../context/AuthContext'
import { useSite, type Site } from '../context/SiteContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FormModal } from '../components/FormModal'
import { CopyButton } from '../components/CopyButton'

interface UserRecord {
  id: string
  username: string
  display_name: string
  role: 'admin' | 'developer' | 'viewer'
  created_at: string
}

// ── Add User Modal ──────────────────────────────────────────────────────

function AddUserModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'developer' | 'viewer'>('viewer')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await apiPost('/auth/register', { display_name: displayName, username, password, role })
      onAdded()
      onClose()
      void toastSuccess('สร้างผู้ใช้สำเร็จ')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'สร้างผู้ใช้ไม่สำเร็จ'
      setError(msg)
      void toastError('สร้างผู้ใช้ไม่สำเร็จ', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal open title="เพิ่มผู้ใช้" onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>ชื่อที่แสดง</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="ชื่อผู้ใช้"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>ชื่อผู้ใช้ (username)</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="user01"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>รหัสผ่าน</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="อย่างน้อย 8 ตัวอักษร"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>สิทธิ์</label>
          <div className="relative">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'developer' | 'viewer')}
              className="w-full px-3 py-2 pr-8 rounded-lg text-sm outline-none appearance-none font-medium"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-accent-blue)', color: 'var(--color-text-primary)' }}
            >
              <option value="admin">admin</option>
              <option value="developer">developer</option>
              <option value="viewer">viewer</option>
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-accent-blue)' }} />
          </div>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--color-accent-red)' }}>{error}</p>}
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'กำลังสร้าง…' : 'สร้างผู้ใช้'}
        </button>
      </form>
    </FormModal>
  )
}

// ── Site Assignment Modal ────────────────────────────────────────────────

function SiteAssignModal({ userId, userName, onClose, onSaved }: { userId: string; userName: string; onClose: () => void; onSaved: () => void }) {
  const { sites } = useSite()
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiGet<string[]>(`/users/${userId}/sites`)
      .then((ids) => setAssignedIds(new Set(ids)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  function toggle(siteId: string) {
    setAssignedIds((prev) => {
      const next = new Set(prev)
      if (next.has(siteId)) next.delete(siteId)
      else next.add(siteId)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiPut(`/users/${userId}/sites`, { site_ids: Array.from(assignedIds) })
      onSaved()
      onClose()
      void toastSuccess('กำหนดเว็บไซต์สำเร็จ')
    } catch {
      void toastError('กำหนดเว็บไซต์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal open title={`กำหนดเว็บไซต์ — ${userName}`} onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-accent-blue)', borderTopColor: 'transparent' }} />
        </div>
      ) : sites.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>ยังไม่มีเว็บไซต์</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-4">
          {sites.map((site) => (
            <label
              key={site.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: assignedIds.has(site.id) ? 'var(--color-bg-surface)' : 'transparent', border: '1px solid var(--color-border)' }}
            >
              <input
                type="checkbox"
                checked={assignedIds.has(site.id)}
                onChange={() => toggle(site.id)}
                className="accent-blue-500"
              />
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{site.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{site.domain}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      <button onClick={() => void handleSave()} disabled={saving} className="w-full px-4 py-2 rounded-lg text-sm font-semibold"
        style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'กำลังบันทึก…' : 'บันทึก'}
      </button>
    </FormModal>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

export function UserManagement() {
  const { user: currentUser } = useAuth()
  const { sites } = useSite()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [siteAssignTarget, setSiteAssignTarget] = useState<UserRecord | null>(null)
  const [generatingToken, setGeneratingToken] = useState<string | null>(null)
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ userId: string; userName: string; oldRole: string; newRole: string } | null>(null)
  const [userSitesMap, setUserSitesMap] = useState<Record<string, string[]>>({})

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<UserRecord[]>('/users')
      setUsers(data)
      // Fetch site assignments for all users
      const siteMap: Record<string, string[]> = {}
      await Promise.all(
        data.map(async (u) => {
          try {
            const ids = await apiGet<string[]>(`/users/${u.id}/sites`)
            siteMap[u.id] = ids
          } catch {
            siteMap[u.id] = []
          }
        })
      )
      setUserSitesMap(siteMap)
    } catch {
      // empty table on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  async function handleRoleChange(userId: string, newRole: 'admin' | 'developer' | 'viewer') {
    try {
      await apiPut(`/users/${userId}`, { role: newRole })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      void toastSuccess('เปลี่ยนสิทธิ์สำเร็จ')
    } catch {
      void toastError('เปลี่ยนสิทธิ์ไม่สำเร็จ')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/users/${deleteTarget.id}`)
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
      void toastSuccess('ลบผู้ใช้สำเร็จ')
    } catch {
      void toastError('ลบผู้ใช้ไม่สำเร็จ')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  async function handleGenerateLink(userId: string) {
    setGeneratingToken(userId)
    try {
      const res = await apiPost<{ access_token: string }>(`/users/${userId}/regenerate-token`, {})
      const url = `${window.location.origin}/shared?token=${res.access_token}`
      await navigator.clipboard.writeText(url)
      void toastSuccess('คัดลอกลิงก์แล้ว!')
    } catch {
      void toastError('สร้างลิงก์ไม่สำเร็จ')
    } finally {
      setGeneratingToken(null)
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={18} style={{ color: 'var(--color-text-secondary)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>จัดการผู้ใช้</h1>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--color-accent-blue)', color: '#fff' }}>
          <Plus size={14} /> เพิ่มผู้ใช้
        </button>
      </div>

      {showAddModal && <AddUserModal onClose={() => setShowAddModal(false)} onAdded={() => void fetchUsers()} />}
      {siteAssignTarget && (
        <SiteAssignModal
          userId={siteAssignTarget.id}
          userName={siteAssignTarget.display_name}
          onClose={() => setSiteAssignTarget(null)}
          onSaved={() => void fetchUsers()}
        />
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-accent-blue)', borderTopColor: 'transparent' }} />
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>ยังไม่มีผู้ใช้</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>ชื่อ</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>ชื่อผู้ใช้</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>สิทธิ์</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>เว็บไซต์</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>วันที่สร้าง</th>
                <th className="px-5 py-3 font-medium text-right" style={{ color: 'var(--color-text-muted)' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-5 py-3" style={{ color: 'var(--color-text-primary)' }}>
                      {u.display_name}
                      {isSelf && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>คุณ</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{u.username}</td>
                    <td className="px-5 py-3">
                      <div className="relative inline-block">
                        <select value={u.role} onChange={(e) => setRoleChangeTarget({ userId: u.id, userName: u.display_name, oldRole: u.role, newRole: e.target.value })} disabled={isSelf}
                          className="px-2.5 py-1 pr-7 rounded-lg text-xs font-medium appearance-none"
                          style={{
                            background: isSelf ? 'transparent' : (u.role === 'admin' ? 'var(--color-accent-blue)' : u.role === 'developer' ? 'var(--color-accent-purple)' : 'var(--color-bg-surface)'),
                            border: isSelf ? 'none' : '1px solid transparent',
                            color: isSelf ? 'var(--color-text-muted)' : (u.role === 'admin' || u.role === 'developer' ? '#fff' : 'var(--color-text-secondary)'),
                            opacity: isSelf ? 0.7 : 0.85,
                          }}>
                          <option value="admin" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>admin</option>
                          <option value="developer" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>developer</option>
                          <option value="viewer" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>viewer</option>
                        </select>
                        {!isSelf && (
                          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: u.role === 'admin' || u.role === 'developer' ? '#fff' : 'var(--color-text-muted)' }} />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {u.role === 'admin' ? (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>ทุกเว็บไซต์</span>
                      ) : (userSitesMap[u.id] ?? []).length === 0 ? (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(userSitesMap[u.id] ?? []).map((siteId) => {
                            const site = sites.find((s) => s.id === siteId)
                            return (
                              <span key={siteId} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
                                {site?.domain ?? siteId.slice(0, 8)}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {u.role !== 'admin' && (
                          <>
                            <button onClick={() => setSiteAssignTarget(u)} className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-secondary)' }} title="กำหนดเว็บไซต์">
                              <Globe size={14} />
                            </button>
                            <button
                              onClick={() => void handleGenerateLink(u.id)}
                              disabled={generatingToken === u.id}
                              className="p-1.5 rounded-lg"
                              style={{ color: 'var(--color-accent-blue)' }}
                              title="สร้าง/คัดลอกลิงก์เข้าถึง"
                            >
                              {generatingToken === u.id ? <RefreshCw size={14} className="animate-spin" /> : <Link size={14} />}
                            </button>
                          </>
                        )}
                        {!isSelf && (
                          <button onClick={() => setDeleteTarget(u)} className="p-1.5 rounded-lg" style={{ color: 'var(--color-accent-red)' }} title="ลบผู้ใช้">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="ลบผู้ใช้"
        message={`ยืนยันลบผู้ใช้ "${deleteTarget?.display_name}" หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
        confirmLabel="ลบ"
        danger
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={roleChangeTarget !== null}
        title="เปลี่ยนสิทธิ์ผู้ใช้"
        message={`ยืนยันเปลี่ยนสิทธิ์ของ "${roleChangeTarget?.userName}" จาก ${roleChangeTarget?.oldRole} เป็น ${roleChangeTarget?.newRole} หรือไม่?`}
        confirmLabel="เปลี่ยน"
        onConfirm={() => {
          if (roleChangeTarget) {
            void handleRoleChange(roleChangeTarget.userId, roleChangeTarget.newRole as 'admin' | 'developer' | 'viewer')
          }
          setRoleChangeTarget(null)
        }}
        onCancel={() => setRoleChangeTarget(null)}
      />
    </div>
  )
}
