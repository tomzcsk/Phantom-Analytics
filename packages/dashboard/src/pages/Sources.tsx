import { useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { useSite } from '../context/SiteContext'
import { useDateRange } from '../context/DateRangeContext'
import { useSources, useDevices } from '../hooks/useAnalytics'
import type { SourceStat } from '@phantom/shared'
import { DatePresets } from '../components/DatePresets'
import { RefreshButton } from '../components/RefreshButton'

const SOURCE_COLORS: Record<SourceStat['source'], string> = {
  direct: '#4F8EF7',
  organic: '#36D963',
  referral: '#9B6EFF',
  social: '#F7B84B',
  email: '#36D9B0',
  paid: '#F75252',
}

const SOURCE_LABELS: Record<SourceStat['source'], string> = {
  direct: 'เข้าตรง',
  organic: 'ค้นหาทั่วไป',
  referral: 'ลิงก์อ้างอิง',
  social: 'โซเชียล',
  email: 'อีเมล',
  paid: 'โฆษณา',
}

const DEVICE_COLORS = ['#4F8EF7', '#36D9B0', '#9B6EFF', '#F7B84B', '#F75252', '#36D963']

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { percentage: number } }>
}

function SourceTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0]
  if (!item) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
    >
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 2 }}>{item.name}</p>
      <p className="font-semibold">
        {item.value.toLocaleString()} ({item.payload.percentage.toFixed(1)}%)
      </p>
    </div>
  )
}

interface BarTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function BarTooltip({ active, payload, label }: BarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0]
  if (!item) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
    >
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 2 }}>{label}</p>
      <p className="font-semibold tabular-nums">{item.value.toLocaleString()}</p>
    </div>
  )
}

type Tab = 'sources' | 'devices'

export function Sources() {
  const { activeSite } = useSite()
  const { range } = useDateRange()
  const [tab, setTab] = useState<Tab>('sources')
  const siteId = activeSite?.id ?? ''

  const { data: sourcesData, isLoading: srcLoading, isFetching: srcFetching } = useSources(siteId, range)
  const { data: devicesData, isLoading: devLoading, isFetching: devFetching } = useDevices(siteId, range)

  const pieData = (sourcesData?.sources ?? []).map((s) => ({
    name: SOURCE_LABELS[s.source],
    value: s.count,
    percentage: s.percentage,
    color: SOURCE_COLORS[s.source],
  }))

  const browserData = (devicesData?.browsers ?? []).map((b, i) => ({
    name: b.browser,
    value: b.count,
    fill: DEVICE_COLORS[i % DEVICE_COLORS.length] ?? '#4F8EF7',
  }))

  const osData = (devicesData?.operating_systems ?? []).map((o, i) => ({
    name: o.os,
    value: o.count,
    fill: DEVICE_COLORS[i % DEVICE_COLORS.length] ?? '#4F8EF7',
  }))

  const devicePieData = (devicesData?.devices ?? []).map((d, i) => ({
    name: d.device_type,
    value: d.count,
    percentage: d.percentage,
    color: DEVICE_COLORS[i % DEVICE_COLORS.length] ?? '#4F8EF7',
  }))

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            แหล่งที่มา
          </h1>
          {/* Tab switcher */}
          <div
            className="flex items-center gap-1 rounded-lg p-1"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <button
              onClick={() => setTab('sources')}
              className="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              style={{
                background: tab === 'sources' ? 'var(--color-bg-surface)' : 'transparent',
                color: tab === 'sources' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              แหล่งทราฟฟิก
            </button>
            <button
              onClick={() => setTab('devices')}
              className="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              style={{
                background: tab === 'devices' ? 'var(--color-bg-surface)' : 'transparent',
                color: tab === 'devices' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              อุปกรณ์
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RefreshButton loading={srcFetching || devFetching} />
          <DatePresets loading={srcFetching || devFetching} />
        </div>
      </div>

      {/* Traffic Sources tab */}
      {tab === 'sources' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Donut chart */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              ช่องทางทราฟฟิก
            </h2>
            {srcLoading ? (
              <div className="animate-pulse rounded" style={{ background: 'var(--color-bg-surface)', height: 220 }} />
            ) : pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<SourceTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                ไม่มีข้อมูลแหล่งที่มาในช่วงนี้
              </p>
            )}
          </div>

          {/* Top referrers */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              แหล่งอ้างอิงยอดนิยม
            </h2>
            {srcLoading ? (
              <div className="flex flex-col gap-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse rounded h-6" style={{ background: 'var(--color-bg-surface)' }} />
                ))}
              </div>
            ) : (sourcesData?.top_referrers ?? []).length > 0 ? (
              <div className="flex flex-col gap-2">
                {sourcesData!.top_referrers.map((ref) => {
                  const max = sourcesData!.top_referrers[0]?.count ?? 1
                  const pct = Math.max(4, (ref.count / max) * 100)
                  return (
                    <div key={ref.domain}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span style={{ color: 'var(--color-text-primary)' }}>{ref.domain}</span>
                        <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                          {ref.count.toLocaleString()} ({ref.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="rounded-full overflow-hidden" style={{ background: 'var(--color-bg-surface)', height: 4 }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: 'var(--color-accent-purple)' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>ไม่มีข้อมูลแหล่งอ้างอิง</p>
            )}
          </div>
        </div>
      )}

      {/* Devices tab (E5-F8) */}
      {tab === 'devices' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Device type donut */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              ประเภทอุปกรณ์
            </h2>
            {devLoading ? (
              <div className="animate-pulse rounded" style={{ background: 'var(--color-bg-surface)', height: 180 }} />
            ) : devicePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={devicePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
                    {devicePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<SourceTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{String(v)}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>ไม่มีข้อมูล</p>
            )}
          </div>

          {/* Browsers bar chart */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              เบราว์เซอร์
            </h2>
            {devLoading ? (
              <div className="animate-pulse rounded" style={{ background: 'var(--color-bg-surface)', height: 180 }} />
            ) : browserData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={browserData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeOpacity={0.5} />
                  <XAxis type="number" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--color-bg-surface)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {browserData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>ไม่มีข้อมูล</p>
            )}
          </div>

          {/* OS bar chart */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              ระบบปฏิบัติการ
            </h2>
            {devLoading ? (
              <div className="animate-pulse rounded" style={{ background: 'var(--color-bg-surface)', height: 180 }} />
            ) : osData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={osData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeOpacity={0.5} />
                  <XAxis type="number" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--color-bg-surface)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {osData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>ไม่มีข้อมูล</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
