'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, LayoutList, Map } from 'lucide-react'
import { type Filters, type Region, type PRColor, type PsfBand } from '@/lib/types'

// ── Shared hook ────────────────────────────────────────────────────────────────

function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return { open, setOpen, ref }
}

// ── Pill button (shared visual base) ──────────────────────────────────────────

function PillButton({
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
        active
          ? 'bg-slate-800 text-white border-slate-800'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
      }`}
    >
      {children}
      <ChevronDown size={13} className={active ? 'text-slate-300' : 'text-slate-400'} />
    </button>
  )
}

// ── Dropdown menu shell ────────────────────────────────────────────────────────

function DropdownMenu({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[180px] rounded-xl bg-white shadow-xl border border-slate-100 py-1 overflow-hidden">
      {children}
    </div>
  )
}

function DropdownItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-50 ${
        selected ? 'font-semibold text-slate-800 bg-slate-50' : 'text-slate-600'
      }`}
    >
      {children}
    </button>
  )
}

// ── Single-select dropdown ─────────────────────────────────────────────────────

function SingleDropdown<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; dot?: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const { open, setOpen, ref } = useDropdown()
  const isActive = value !== options[0].value
  const current = options.find(o => o.value === value) ?? options[0]

  return (
    <div ref={ref} className="relative shrink-0">
      <PillButton active={isActive} onClick={() => setOpen(v => !v)}>
        {current.dot && (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: current.dot }} />
        )}
        {current.label}
      </PillButton>

      {open && (
        <DropdownMenu>
          {options.map(opt => (
            <DropdownItem
              key={String(opt.value)}
              selected={value === opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            >
              <span className="flex items-center gap-2">
                {opt.dot && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dot }} />
                )}
                {opt.label}
              </span>
            </DropdownItem>
          ))}
        </DropdownMenu>
      )}
    </div>
  )
}

// ── Programmes multi-select dropdown ──────────────────────────────────────────

const PROG_OPTIONS = [
  { key: 'gep' as const, label: 'GEP', desc: 'Gifted Education Programme Centre' },
  { key: 'sap' as const, label: 'SAP', desc: 'Special Assistance Plan (Chinese bilingual)' },
  { key: 'alp' as const, label: 'ALP', desc: 'Applied Learning Programme focus' },
  { key: 'ip'  as const, label: 'IP',  desc: 'Integrated Programme feeder — no O-levels' },
]

function ProgDropdown({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (f: Filters) => void
}) {
  const { open, setOpen, ref } = useDropdown()
  const active = PROG_OPTIONS.filter(p => filters[p.key])
  const isActive = active.length > 0
  const label = isActive ? active.map(p => p.label).join(' · ') : 'All Programmes'

  return (
    <div ref={ref} className="relative shrink-0">
      <PillButton active={isActive} onClick={() => setOpen(v => !v)}>
        {label}
      </PillButton>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-80 rounded-xl bg-white shadow-xl border border-slate-100 py-1.5 overflow-hidden">
          {/* All option */}
          <button
            onClick={() => onChange({ ...filters, gep: false, sap: false, alp: false, ip: false })}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-slate-50 ${
              !isActive ? 'font-semibold text-slate-800 bg-slate-50' : 'text-slate-500'
            }`}
          >
            <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
              !isActive ? 'bg-slate-800 border-slate-800' : 'border-slate-300'
            }`}>
              {!isActive && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            <span>All Programmes</span>
          </button>

          <div className="h-px bg-slate-100 mx-2 my-1" />

          {PROG_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => onChange({ ...filters, [opt.key]: !filters[opt.key] })}
              className="w-full flex items-start gap-3 px-3 py-2 text-sm transition-colors hover:bg-slate-50 text-left"
            >
              <span className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                filters[opt.key] ? 'bg-slate-800 border-slate-800' : 'border-slate-300'
              }`}>
                {filters[opt.key] && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <div className="min-w-0">
                <span className="font-semibold text-slate-800">{opt.label}</span>
                <span className="text-slate-400 ml-2 text-xs">{opt.desc}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Filter definitions ─────────────────────────────────────────────────────────

const REGION_OPTIONS: { value: Region | 'All'; label: string }[] = [
  { value: 'All',     label: 'All Regions' },
  { value: 'North',   label: 'North' },
  { value: 'South',   label: 'South' },
  { value: 'East',    label: 'East' },
  { value: 'West',    label: 'West' },
  { value: 'Central', label: 'Central' },
]

const ACCESS_OPTIONS: { value: PRColor | 'All' | 'emerging'; label: string; dot?: string }[] = [
  { value: 'All',      label: 'All Access' },
  { value: 'green',    label: 'Open',      dot: '#22c55e' },
  { value: 'amber',    label: 'Possible',  dot: '#f59e0b' },
  { value: 'orange',   label: 'Marginal',  dot: '#f97316' },
  { value: 'grey',     label: 'Closed',    dot: '#4C1D95' },
  { value: 'emerging', label: 'Emerging',  dot: '#94a3b8' },
]

const QUALITY_OPTIONS: { value: 1 | 2 | 3 | 'All'; label: string }[] = [
  { value: 'All', label: 'Any Quality' },
  { value: 3,     label: '★★★ Top' },
  { value: 2,     label: '★★ Good' },
  { value: 1,     label: '★ Standard' },
]

const PSF_OPTIONS: { value: PsfBand; label: string; dot?: string }[] = [
  { value: 'All',     label: 'Any Zone' },
  { value: 'budget',  label: 'Budget  < $600',   dot: '#059669' },
  { value: 'mid',     label: 'Mid  $600–750',     dot: '#d97706' },
  { value: 'premium', label: 'Premium  > $750',   dot: '#dc2626' },
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

  // Access dropdown combines `access` + `emerging` into one value
  const accessValue: PRColor | 'All' | 'emerging' =
    filters.emerging ? 'emerging' : filters.access

  function handleAccess(val: PRColor | 'All' | 'emerging') {
    if (val === 'emerging') {
      onChange({ ...filters, access: 'All', emerging: true })
    } else {
      onChange({ ...filters, access: val as PRColor | 'All', emerging: false })
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

        <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0 ml-auto">
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

      {/* ── Row 2: five uniform pill dropdowns ── */}
      <div className="flex items-center gap-2 px-4 pb-2.5">
        <SingleDropdown
          options={REGION_OPTIONS}
          value={filters.region}
          onChange={v => set('region', v)}
        />
        <SingleDropdown
          options={ACCESS_OPTIONS}
          value={accessValue}
          onChange={handleAccess}
        />
        <SingleDropdown
          options={QUALITY_OPTIONS}
          value={filters.tier}
          onChange={v => set('tier', v)}
        />
        <ProgDropdown filters={filters} onChange={onChange} />
        <SingleDropdown
          options={PSF_OPTIONS}
          value={filters.psf}
          onChange={v => set('psf', v)}
        />
      </div>
    </div>
  )
}
