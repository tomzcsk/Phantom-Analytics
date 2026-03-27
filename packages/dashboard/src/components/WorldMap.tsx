import { useState } from 'react'
import type { GeoStat } from '@phantom/shared'

/**
 * Simplified SVG world map — choropleth colored by visitor count.
 * Uses hardcoded path data for ~50 major countries (covers 95%+ of web traffic).
 * No external map library needed.
 */

// ISO alpha-2 → simplified SVG path (viewBox 0 0 1000 500)
// Paths are highly simplified outlines for visual representation only
const COUNTRY_PATHS: Record<string, string> = {
  US: 'M45,170 L180,170 L190,200 L160,210 L140,200 L120,210 L100,200 L60,200 Z M200,165 L230,140 L280,140 L280,200 L245,210 L200,195 Z',
  CA: 'M50,80 L280,80 L290,130 L270,140 L230,130 L180,160 L45,160 L30,120 Z',
  MX: 'M80,210 L160,210 L180,240 L160,260 L120,260 L90,240 Z',
  BR: 'M280,280 L340,260 L370,290 L360,360 L320,380 L280,360 L270,320 Z',
  AR: 'M280,360 L310,380 L300,440 L270,460 L260,420 L270,380 Z',
  GB: 'M445,120 L455,110 L460,130 L450,140 Z',
  FR: 'M450,145 L475,140 L480,165 L465,175 L445,170 Z',
  DE: 'M475,125 L500,120 L505,150 L485,155 L475,140 Z',
  IT: 'M485,155 L500,155 L510,190 L495,195 L488,175 Z',
  ES: 'M430,165 L465,160 L465,185 L430,185 Z',
  PT: 'M425,165 L430,165 L430,185 L425,185 Z',
  NL: 'M470,120 L480,118 L480,128 L470,130 Z',
  BE: 'M465,128 L475,128 L475,135 L465,135 Z',
  CH: 'M475,145 L485,143 L487,150 L477,152 Z',
  AT: 'M487,143 L505,140 L507,150 L488,150 Z',
  PL: 'M500,115 L530,110 L535,135 L505,138 Z',
  SE: 'M490,60 L505,50 L510,100 L495,110 Z',
  NO: 'M470,40 L495,35 L495,105 L480,110 L475,70 Z',
  FI: 'M510,45 L530,40 L535,90 L515,100 L510,70 Z',
  DK: 'M475,105 L490,100 L490,115 L478,118 Z',
  RU: 'M540,40 L900,30 L920,100 L800,120 L700,100 L600,110 L540,100 Z',
  UA: 'M530,115 L570,110 L580,130 L545,135 Z',
  TR: 'M540,155 L590,148 L600,165 L545,168 Z',
  IN: 'M660,200 L700,180 L720,220 L700,280 L670,270 L660,240 Z',
  CN: 'M720,120 L830,110 L850,170 L800,200 L740,200 L710,170 Z',
  JP: 'M860,150 L870,140 L880,160 L870,175 L860,165 Z',
  KR: 'M840,155 L850,148 L855,168 L845,172 Z',
  TW: 'M835,195 L840,188 L843,200 L838,203 Z',
  TH: 'M730,230 L745,220 L750,250 L738,260 L730,245 Z',
  VN: 'M750,210 L760,200 L765,250 L755,260 L748,240 Z',
  ID: 'M740,290 L820,280 L830,295 L780,305 L740,300 Z',
  PH: 'M800,230 L815,220 L820,250 L810,255 L800,240 Z',
  MY: 'M745,265 L770,260 L775,275 L750,278 Z',
  SG: 'M755,278 L760,276 L761,280 L756,281 Z',
  AU: 'M790,350 L880,330 L900,370 L880,410 L820,410 L790,380 Z',
  NZ: 'M920,400 L930,390 L935,415 L925,420 Z',
  ZA: 'M510,380 L550,370 L560,400 L530,410 L510,400 Z',
  NG: 'M470,260 L495,255 L500,280 L475,282 Z',
  EG: 'M530,195 L555,190 L560,220 L535,225 Z',
  KE: 'M550,275 L565,268 L570,290 L555,295 Z',
  SA: 'M570,200 L610,190 L620,225 L590,235 L570,225 Z',
  AE: 'M615,215 L630,210 L632,222 L618,225 Z',
  IL: 'M545,185 L550,182 L551,198 L546,200 Z',
  IR: 'M600,165 L640,155 L650,190 L615,195 Z',
  PK: 'M640,180 L670,170 L680,200 L655,210 Z',
  BD: 'M700,215 L715,210 L718,228 L705,230 Z',
  CO: 'M230,260 L260,250 L265,280 L240,285 Z',
  CL: 'M255,360 L265,350 L268,450 L258,460 Z',
  PE: 'M235,285 L260,280 L258,330 L235,335 Z',
}

function getColor(value: number, max: number): string {
  if (value === 0) return 'var(--color-bg-surface)'
  const ratio = Math.min(value / max, 1)
  // Interpolate from light blue to accent blue
  const opacity = 0.15 + ratio * 0.85
  return `rgba(79, 142, 247, ${opacity})`
}

interface WorldMapProps {
  data: GeoStat[]
  onCountryClick?: (code: string, name: string) => void
  selectedCountry?: string | null | undefined
}

export function WorldMap({ data, onCountryClick, selectedCountry }: WorldMapProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const dataMap = new Map(data.map((d) => [d.country_code, d]))
  const maxVisitors = data.length > 0 ? Math.max(...data.map((d) => d.visitors)) : 1

  const hoveredData = hovered ? dataMap.get(hovered) : null

  return (
    <div className="relative">
      <svg
        viewBox="0 0 1000 500"
        className="w-full"
        style={{ maxHeight: 320 }}
      >
        {/* Background */}
        <rect width="1000" height="500" fill="var(--color-bg-card)" rx="8" />

        {/* Country paths */}
        {Object.entries(COUNTRY_PATHS).map(([code, path]) => {
          const stat = dataMap.get(code)
          const isSelected = selectedCountry === code
          const isHovered = hovered === code
          return (
            <path
              key={code}
              d={path}
              fill={isSelected ? 'var(--color-accent-purple)' : getColor(stat?.visitors ?? 0, maxVisitors)}
              stroke={isHovered ? 'var(--color-accent-blue)' : 'var(--color-border)'}
              strokeWidth={isHovered || isSelected ? 1.5 : 0.5}
              style={{ cursor: stat ? 'pointer' : 'default', transition: 'fill 0.2s' }}
              onMouseEnter={() => setHovered(code)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => stat && onCountryClick?.(code, stat.country_name)}
            />
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredData && (
        <div
          className="absolute top-3 right-3 rounded-lg px-3 py-2 text-sm shadow-lg pointer-events-none"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <p className="font-medium">{hoveredData.country_name}</p>
          <p className="tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
            {hoveredData.visitors.toLocaleString()} ผู้เข้าชม ({hoveredData.percentage.toFixed(1)}%)
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-2 mt-2 px-1">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>น้อย</span>
        <div className="flex-1 h-2 rounded-full" style={{ background: 'linear-gradient(to right, rgba(79,142,247,0.15), rgba(79,142,247,1))' }} />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>มาก</span>
      </div>
    </div>
  )
}
