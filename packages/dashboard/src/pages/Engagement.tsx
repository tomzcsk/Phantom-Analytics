import { useState } from 'react'
import { Plus, Trash2, Edit3, Save } from 'lucide-react'
import { CopyButton } from '../components/CopyButton'
import { useQueryClient } from '@tanstack/react-query'
import { useSite } from '../context/SiteContext'
import { apiPost, apiPut, apiDelete } from '../lib/api'
import { useDateRange } from '../context/DateRangeContext'
import { useScrollDepth, useClicks, useClickVariables } from '../hooks/useAnalytics'
import { DatePresets } from '../components/DatePresets'
import { RefreshButton } from '../components/RefreshButton'
import { ExportButton } from '../components/ExportButton'
import type { ClickVariable } from '../hooks/useAnalytics'
import { ScrollDepthChart } from '../components/ScrollDepthChart'
import { ClicksTable } from '../components/ClicksTable'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FormModal } from '../components/FormModal'
import { toastSuccess, toastError } from '../lib/toast'
import { useAuth } from '../context/AuthContext'

type Tab = 'scroll' | 'clicks'

function CopyBtn({ text }: { text: string }) {
  return <CopyButton text={text} size="sm" />
}

function ClickVariableManager({ siteId }: { siteId: string }) {
  const { isDeveloper } = useAuth()
  const { data: variables } = useClickVariables(siteId)
  const [showForm, setShowForm] = useState(false)
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateConfirm, setShowCreateConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const qc = useQueryClient()

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    setShowCreateConfirm(true)
  }

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      await apiPost('/click-variables', { site_id: siteId, key, name })
      await qc.invalidateQueries({ queryKey: ['click-variables', siteId] })
      setKey('')
      setName('')
      setShowForm(false)
      setShowCreateConfirm(false)
      void toastSuccess('สร้างตัวแปรคลิกสำเร็จ')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setError(msg)
      void toastError('สร้างตัวแปรไม่สำเร็จ', msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id: string) {
    try {
      await apiPut(`/click-variables/${id}`, { name: editName })
      await qc.invalidateQueries({ queryKey: ['click-variables', siteId] })
      setEditingId(null)
      void toastSuccess('แก้ไขตัวแปรสำเร็จ')
    } catch {
      void toastError('แก้ไขไม่สำเร็จ')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/click-variables/${deleteTarget.id}`)
      await qc.invalidateQueries({ queryKey: ['click-variables', siteId] })
      void toastSuccess('ลบตัวแปรสำเร็จ')
    } catch {
      void toastError('ลบไม่สำเร็จ')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          ตัวแปรคลิก
        </h2>
        {isDeveloper && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
          >
            <Plus size={12} /> สร้างตัวแปร
          </button>
        )}
      </div>

      <FormModal open={showForm} title="สร้างตัวแปรคลิก" onClose={() => { setShowForm(false); setError(null) }}>
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              คีย์ (ภาษาอังกฤษ)
            </p>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              required
              placeholder="เช่น buy_button"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              ชื่อที่แสดง
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="เช่น ปุ่มซื้อสินค้า"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--color-accent-red)' }}>{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--color-accent-blue)', color: '#fff', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'กำลังสร้าง…' : 'สร้าง'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null) }}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </FormModal>

      {(variables ?? []).length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  คีย์
                </th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  ชื่อที่แสดง
                </th>
                {isDeveloper && (
                  <th className="text-left px-5 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    โค้ด
                  </th>
                )}
                <th className="px-5 py-3 font-medium text-right" style={{ color: 'var(--color-text-muted)' }}>
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody>
              {(variables ?? []).map((v, i) => (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-5 py-3 font-mono" style={{ color: 'var(--color-accent-blue)' }}>{v.key}</td>
                  <td className="px-5 py-3" style={{ color: 'var(--color-text-primary)' }}>{v.name}</td>
                  {isDeveloper && (
                    <td className="px-5 py-3">
                      <CopyBtn text={`data-pa-click="${v.key}"`} />
                    </td>
                  )}
                  {isDeveloper && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingId(v.id); setEditName(v.name) }}
                          className="p-1.5 rounded-lg"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: v.id, name: v.name })}
                          className="p-1.5 rounded-lg"
                          style={{ color: 'var(--color-accent-red)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(variables ?? []).length === 0 && !showForm && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          ยังไม่มีตัวแปรคลิก กดสร้างเพื่อตั้งชื่อให้กับปุ่มที่ต้องการ track
        </p>
      )}

      <ConfirmDialog
        open={showCreateConfirm}
        title="สร้างตัวแปรคลิก"
        message={`ยืนยันสร้างตัวแปร "${name}" (คีย์: ${key}) หรือไม่?`}
        confirmLabel="สร้าง"
        loading={saving}
        onConfirm={() => void handleCreate()}
        onCancel={() => setShowCreateConfirm(false)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="ลบตัวแปรคลิก"
        message={`ยืนยันลบตัวแปร "${deleteTarget?.name ?? ''}" หรือไม่?`}
        confirmLabel="ลบ"
        danger
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
      <FormModal open={!!editingId} title="แก้ไขตัวแปรคลิก" onClose={() => setEditingId(null)} width="w-80">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>ชื่อที่แสดง</p>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { if (editingId) void handleUpdate(editingId) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
            >
              <Save size={14} /> บันทึก
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </FormModal>
    </div>
  )
}

export function Engagement() {
  const { isDeveloper } = useAuth()
  const { activeSite } = useSite()
  const { range } = useDateRange()
  const [tab, setTab] = useState<Tab>('scroll')
  const siteId = activeSite?.id ?? ''

  const { data: scrollDepth, isLoading: scrollLoading, isFetching: scrollFetching } = useScrollDepth(siteId, range)
  const { data: clicks, isLoading: clicksLoading, isFetching: clicksFetching } = useClicks(siteId, range)
  const { data: clickVars } = useClickVariables(siteId)

  // Build name map for clicks table
  const nameMap = new Map((clickVars ?? []).map((v) => [v.key, v.name]))

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            พฤติกรรมผู้ใช้
          </h1>
          <div
            className="flex items-center gap-1 rounded-lg p-1"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <button
              onClick={() => setTab('scroll')}
              className="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              style={{
                background: tab === 'scroll' ? 'var(--color-bg-surface)' : 'transparent',
                color: tab === 'scroll' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              การเลื่อนดูหน้า
            </button>
            <button
              onClick={() => setTab('clicks')}
              className="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              style={{
                background: tab === 'clicks' ? 'var(--color-bg-surface)' : 'transparent',
                color: tab === 'clicks' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              การคลิก
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            headers={tab === 'scroll'
              ? ['URL', 'ความลึกเฉลี่ย (%)', 'ถึง 25%', 'ถึง 50%', 'ถึง 75%', 'ถึง 100%', 'การเข้าชม']
              : ['คีย์', 'ชื่อ', 'จำนวนคลิก', 'ผู้คลิกไม่ซ้ำ']}
            rows={tab === 'scroll'
              ? (scrollDepth ?? []).map((s) => [s.url, s.avg_max_depth.toFixed(1), s.reached_25, s.reached_50, s.reached_75, s.reached_100, s.total_pageviews])
              : (clicks ?? []).map((c) => [c.element_id, nameMap.get(c.element_id) ?? c.element_id, c.click_count, c.unique_clickers])}
            filename={`${tab === 'scroll' ? 'scroll-depth' : 'clicks'}-${activeSite?.name ?? 'site'}-${range.from}_${range.to}`}
            disabled={tab === 'scroll' ? (scrollLoading || (scrollDepth ?? []).length === 0) : (clicksLoading || (clicks ?? []).length === 0)}
          />
          <RefreshButton loading={scrollFetching || clicksFetching} />
          <DatePresets loading={scrollFetching || clicksFetching} />
        </div>
      </div>

      {tab === 'scroll' && (
        <ScrollDepthChart data={scrollDepth ?? []} loading={scrollLoading} />
      )}

      {tab === 'clicks' && (
        <>
          {isDeveloper && <ClickVariableManager siteId={siteId} />}
          <ClicksTable clicks={clicks ?? []} loading={clicksLoading} nameMap={nameMap} />
        </>
      )}
    </div>
  )
}
