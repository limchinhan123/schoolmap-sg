'use client'

import { useState, useRef, useEffect } from 'react'
import { type Filters, type Region, type PRColor, type PsfBand } from '@/lib/types'
import { LayoutList, Map, Info } from 'lucide-react'

// ── Dropdown component ─────────────────────────────────────────────────────────

interface DropdownOption<T> {
  value: T
  label: string
  dot?: string
}

function Dropdown<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: DropdownOption<T>[]
  value: T
  onChange: (v: T) => void
}) {
  const active = options.find(o => o.value === value)
  const isFiltered = value !== options[0].value

  return (
    <div className="relative shrink-0">
      <select
        value={String(value)}
        onChange={e => {
          const raw = e.target.value
          // Preserve original type (number or string)
          const typed = typeof options[0].value === 'number' ? (Number(raw) as unknown as T) : (raw as unknown as T)
          onChange(typed)
        }}
        className={`appearance-none cursor-pointer pl-2.5 pr-6 py-1 rounded-full text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 ${
          isFiltered
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
        }`}
      >
        {options.map(opt => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
      {/* Custom dropdown arrow */}
      <span className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] ${
        isFiltered ? 'text-slate-300' : 'text-slate-400'
      }`}>▾</span>
      {/* Inline label prefix when filtered */}
      {isFiltered && (
        <span className="sr-only">{label}:</span>
      )}
    </div>
  )
}

// ── Chip component ─────────────────────────────────────────────────────────────

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

// ── Programme info popover ─────────────────────────────────────────────────────

function ProgInfo() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="Programme definitions"
      >
        <Info size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-50 w-72 rounded-xl bg-white shadow-xl border border-slate-100 p-3 text-xs">
          <p className="font-semibold text-slate-700 mb-2">Special Programmes</p>
          <div className="space-y-1.5 text-slate-600">
            <div className="flex gap-2">
              <span className="font-semibold text-slate-800 w-8 shrink-0">GEP</span>
              <span>Gifted Education Programme — school hosts GEP classes for identified students</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-slate-800 w-8 shrink-0">SAP</span>
              <span>Special Assistance Plan — bilingual school with deep Chinese language focus</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-slate-800 w-8 shrink-0">ALP</span>
              <span>Applied Learning Programme — specialised real-world learning focus (e.g. robotics, biotech)</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-slate-800 w-8 shrink-0">IP</span>
              <span>Integrated Programme feeder — affiliated secondary skips O-levels, goes straight to A-levels / IB</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Region dropdown options ────────────────────────────────────────────────────

const REGION_OPTIONS: DropdownOption<Region | 'All'>[] = [
  { value: 'All',     label: 'All Regions' },
  { value: 'North',   label: 'North' },
  { value: 'South',   label: 'South' },
  { value: 'East',    label: 'East' },
  { value: 'West',    label: 'West' },
  { value: 'Central', label: 'Central' },
]

// ── Access dropdown options (includes Emerging) ────────────────────────────────

const ACCESS_OPTIONS: DropdownOption<PRColor | 'All' | 'emerging'>[] = [
  { value: 'All',      label: 'All Access' },
  { value: 'green',    label: '● Open' },
  { value: 'amber',    label: '● Possible' },
  { value: 'orange',   label: '● Marginal' },
  { value: 'grey',     label: '● Closed' },
  { value: 'emerging', label: '◌ Emerging' },
]

// ── Quality chips ──────────────────────────────────────────────────────────────

const QUALITY_OPTIONS: { value: 1 | 2 | 3 | 'All'; label: string }[] = [
  { value: 'All', label: 'Any' },
  { value: 3,     label: '★★★ Top' },
  { value: 2,     label: '★★ Good' },
  { value: 1,     label: '★ Standard' },
]

// ── PSF chips ──────────────────────────────────────────────────────────────────

const PSF_OPTIONS: { value: PsfBand; label: string; color?: string }[] = [
  { value: 'All',     label: 'All' },
  { value: 'budget',  label: '< $600',    color: '#059669' },
  { value: 'mid',     label: '$600–750',  color: '#d97706' },
  { value: 'premium', label: '> $750',    color: '#dc2626' },
]

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  view: 'map' | 'list'
  onViewChange: (v: 'map' | 'list') => void
  resultCount: number
  total: number
}

// ── FilterBar ──────────────────────────────────────────────────────────────────

export default function FilterBar({ filters, onChange, view, onViewChange, resultCount, total }: Props) {
  function set<K extends keyof Filters>(key: K, val: Filters[K]) {
    onChange({ ...filters, [key]: val })
  }

  // Access dropdown drives both `access` and `emerging` fields
  const accessValue: PRColor | 'All' | 'emerging' =
    filters.emerging ? 'emerging' : filters.access

  function handleAccessChange(val: PRColor | 'All' | 'emerging') {
    if (val === 'emerging') {
      onChange({ ...filters, access: 'All', emerging: true })
    } else {
      onChange({ ...filters, access: val, emerging: false })
    }
  }

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm z-20 shrink-0">
      {/* ── Row 1: logo + search + count + view toggle ── */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="font-bold text-slate-800 text-base tracking-tight shrink-0">
          Kiasu School Hunt
        </span>

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

      {/* ── Row 2: all filters in one compact strip ── */}
      <div className="flex items-center gap-2 px-4 pb-2.5 overflow-x-auto">

        {/* Region dropdown */}
        <Dropdown
          label="Region"
          options={REGION_OPTIONS}
          value={filters.region}
          onChange={v => set('region', v)}
        />

        <div className="w-px h-5 bg-slate-200 shrink-0" />

        {/* Access dropdown (includes Emerging) */}
        <Dropdown
          label="Access"
          options={ACCESS_OPTIONS}
          value={accessValue}
          onChange={handleAccessChange}
        />

        <div className="w-px h-5 bg-slate-200 shrink-0" />

        {/* Quality chips */}
        <span className="text-xs font-semibold text-slate-400 shrink-0 uppercase tracking-wide">Quality</span>
        {QUALITY_OPTIONS.map(opt => (
          <Chip key={opt.value} active={filters.tier === opt.value} onClick={() => set('tier', opt.value)}>
            {opt.label}
          </Chip>
        ))}

        <div className="w-px h-5 bg-slate-200 shrink-0" />

        {/* Programme chips + info popover */}
        <span className="text-xs font-semibold text-slate-400 shrink-0 uppercase tracking-wide">Prog</span>
        <ProgInfo />
        {(['gep', 'sap', 'alp', 'ip'] as const).map(key => (
          <Chip key={key} active={filters[key]} onClick={() => set(key, !filters[key])}>
            {key.toUpperCase()}
          </Chip>
        ))}

        <div className="w-px h-5 bg-slate-200 shrink-0" />

        {/* Zone PSF chips */}
        <span className="text-xs font-semibold text-slate-400 shrink-0 uppercase tracking-wide">Zone PSF</span>
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
