'use client'

import { type Filters, type Region, type PRColor, type PsfBand } from '@/lib/types'
import { LayoutList, Map } from 'lucide-react'

const REGIONS: (Region | 'All')[] = ['All', 'North', 'South', 'East', 'West', 'Central']
const ACCESS_OPTIONS: { value: PRColor | 'All'; label: string; dot?: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'green', label: 'Open', dot: '#22c55e' },
  { value: 'amber', label: 'Possible', dot: '#f59e0b' },
  { value: 'orange', label: 'Marginal', dot: '#f97316' },
  { value: 'grey', label: 'Closed', dot: '#4C1D95' },
]
const PSF_OPTIONS: { value: PsfBand; label: string; color?: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'budget', label: '< $600', color: '#059669' },
  { value: 'mid', label: '$600–750', color: '#d97706' },
  { value: 'premium', label: '> $750', color: '#dc2626' },
]

const TIER_OPTIONS: { value: 1 | 2 | 3 | 'All'; label: string }[] = [
  { value: 'All', label: 'All Tiers' },
  { value: 3, label: '★★★' },
  { value: 2, label: '★★' },
  { value: 1, label: '★' },
]

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  view: 'map' | 'list'
  onViewChange: (v: 'map' | 'list') => void
  resultCount: number
  total: number
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
        active
          ? 'bg-slate-800 text-white border-slate-800'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

export default function FilterBar({ filters, onChange, view, onViewChange, resultCount, total }: Props) {
  function set<K extends keyof Filters>(key: K, val: Filters[K]) {
    onChange({ ...filters, [key]: val })
  }

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm z-20 shrink-0">
      {/* Top row: logo + search + view toggle */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="font-bold text-slate-800 text-base tracking-tight shrink-0">SchoolMap SG</span>

        <div className="flex-1 max-w-xs">
          <input
            type="search"
            placeholder="Search school…"
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50"
          />
        </div>

        <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
          {resultCount}/{total}
        </span>

        {/* View toggle */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
          <button
            onClick={() => onViewChange('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'map' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Map size={14} />
            Map
          </button>
          <button
            onClick={() => onViewChange('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
              view === 'list' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <LayoutList size={14} />
            List
          </button>
        </div>
      </div>

      {/* Filter chips row */}
      <div className="flex items-center gap-2 px-4 pb-2.5 overflow-x-auto">
        {/* Region */}
        <span className="text-xs font-semibold text-slate-400 shrink-0 uppercase tracking-wide">Region</span>
        {REGIONS.map(r => (
          <Chip key={r} active={filters.region === r} onClick={() => set('region', r)}>
            {r}
          </Chip>
        ))}

        <div className="w-px h-5 bg-slate-200 shrink-0 mx-1" />

        {/* Access */}
        <span className="text-xs font-semibold text-slate-400 shrink-0 uppercase tracking-wide">Access</span>
        {ACCESS_OPTIONS.map(opt => (
          <Chip key={opt.value} active={filters.access === opt.value} onClick={() => set('access', opt.value)}>
            <span className="flex items-center gap-1.5">
              {opt.dot && (
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: opt.dot }}
                />
              )}
              {opt.label}
            </span>
          </Chip>
        ))}

        <div className="w-px h-5 bg-slate-200 shrink-0 mx-1" />

        {/* Tier */}
        <span className="text-xs font-semibold text-slate-400 shrink-0 uppercase tracking-wide">Tier</span>
        {TIER_OPTIONS.map(opt => (
          <Chip key={opt.value} active={filters.tier === opt.value} onClick={() => set('tier', opt.value)}>
            {opt.label}
          </Chip>
        ))}

        <div className="w-px h-5 bg-slate-200 shrink-0 mx-1" />

        {/* Special programmes */}
        <span className="text-xs font-semibold text-slate-400 shrink-0 uppercase tracking-wide">Prog</span>
        {(['gep', 'sap', 'alp', 'ip'] as const).map(key => (
          <Chip
            key={key}
            active={filters[key]}
            onClick={() => set(key, !filters[key])}
          >
            {key.toUpperCase()}
          </Chip>
        ))}

        <div className="w-px h-5 bg-slate-200 shrink-0 mx-1" />

        {/* Emerging schools */}
        <Chip active={filters.emerging} onClick={() => set('emerging', !filters.emerging)}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full border-2 border-current opacity-70" />
            Emerging
          </span>
        </Chip>

        <div className="w-px h-5 bg-slate-200 shrink-0 mx-1" />

        {/* PSF affordability */}
        <span className="text-xs font-semibold text-slate-400 shrink-0 uppercase tracking-wide">PSF</span>
        {PSF_OPTIONS.map(opt => (
          <Chip key={opt.value} active={filters.psf === opt.value} onClick={() => set('psf', opt.value)}>
            <span className="flex items-center gap-1.5">
              {opt.color && (
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
              )}
              {opt.label}
            </span>
          </Chip>
        ))}
      </div>
    </div>
  )
}
