'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, LayoutList, Map, SlidersHorizontal, X } from 'lucide-react'
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

// ── Active filter count ────────────────────────────────────────────────────────

function useActiveFilterCount(filters: Filters): number {
  let n = 0
  if (filters.region !== 'All') n++
  if (filters.access !== 'All' || filters.emerging) n++
  if (filters.tier !== 'All') n++
  if (filters.gep || filters.sap || filters.alp || filters.ip) n++
  if (filters.psf !== 'All') n++
  return n
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

// ── Quality single-select dropdown with descriptions ──────────────────────────

const QUALITY_OPTIONS: { value: 1 | 2 | 3 | 'All'; label: string; stars?: string; desc: string }[] = [
  { value: 'All', label: 'Any Quality',  desc: 'Show all schools regardless of signals' },
  { value: 3,     label: 'Flagship',     stars: '★★★', desc: 'Autonomous school with special programmes and a strong secondary affiliation' },
  { value: 2,     label: 'Established',  stars: '★★',  desc: 'Meets any two of: autonomous status, special programmes, strong affiliation' },
  { value: 1,     label: 'Neighbourhood',stars: '★',   desc: 'Community school; strong on location and ballot accessibility' },
]

function QualityDropdown({
  value,
  onChange,
}: {
  value: 1 | 2 | 3 | 'All'
  onChange: (v: 1 | 2 | 3 | 'All') => void
}) {
  const { open, setOpen, ref } = useDropdown()
  const isActive = value !== 'All'
  const current = QUALITY_OPTIONS.find(o => o.value === value) ?? QUALITY_OPTIONS[0]
  const label = isActive ? `${current.stars} ${current.label}` : 'Any Quality'

  return (
    <div ref={ref} className="relative shrink-0">
      <PillButton active={isActive} onClick={() => setOpen(v => !v)}>
        {label}
      </PillButton>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-80 rounded-xl bg-white shadow-xl border border-slate-100 py-1.5 overflow-hidden">
          {QUALITY_OPTIONS.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="w-full flex items-start gap-3 px-3 py-2 text-sm transition-colors hover:bg-slate-50 text-left"
            >
              {/* radio dot */}
              <span className={`mt-0.5 w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                value === opt.value ? 'border-slate-800' : 'border-slate-300'
              }`}>
                {value === opt.value && (
                  <span className="w-2 h-2 rounded-full bg-slate-800" />
                )}
              </span>
              <div className="min-w-0">
                <span className="font-semibold text-slate-800">
                  {opt.stars ? `${opt.stars} ` : ''}{opt.label}
                </span>
                <span className="text-slate-400 ml-2 text-xs">{opt.desc}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Access options (defined here so AccessDropdown and sheet both reference the same array) ──

const ACCESS_OPTIONS: { value: PRColor | 'All' | 'emerging'; label: string; dot?: string; desc?: string }[] = [
  { value: 'All',      label: 'Got Chance for PR?' },
  { value: 'green',    label: 'Open',      dot: '#22c55e', desc: 'PRs have reached the ballot in recent years' },
  { value: 'amber',    label: 'Possible',  dot: '#f59e0b', desc: 'Demand softening — a window may be opening' },
  { value: 'orange',   label: 'Marginal',  dot: '#f97316', desc: 'Patchy history — occasional chance, not reliable' },
  { value: 'grey',     label: 'Closed',    dot: '#4C1D95', desc: 'Oversubscribed by SCs — no realistic PR window' },
  { value: 'emerging', label: 'Emerging',  dot: '#94a3b8', desc: 'New school or limited data — outcome uncertain' },
]

// ── Access dropdown (single-select with dot + two-line description rows) ─────────

function AccessDropdown({
  value,
  onChange,
}: {
  value: PRColor | 'All' | 'emerging'
  onChange: (v: PRColor | 'All' | 'emerging') => void
}) {
  const { open, setOpen, ref } = useDropdown()
  const isActive = value !== 'All'
  const current = ACCESS_OPTIONS.find(o => o.value === value) ?? ACCESS_OPTIONS[0]

  return (
    <div ref={ref} className="relative shrink-0">
      <PillButton active={isActive} onClick={() => setOpen(v => !v)}>
        {current.dot && (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: current.dot }} />
        )}
        {current.label}
      </PillButton>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl bg-white shadow-xl border border-slate-100 py-1 overflow-hidden">
          {ACCESS_OPTIONS.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full flex items-start gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-slate-50 text-left ${
                value === opt.value ? 'bg-slate-50' : ''
              }`}
            >
              {/* colour dot or placeholder for 'All' */}
              <span className="mt-0.5 shrink-0 w-3 h-3 rounded-full" style={
                opt.dot ? { backgroundColor: opt.dot } : { border: '1.5px solid #cbd5e1' }
              } />
              <div className="min-w-0">
                <div className={`font-semibold leading-snug ${value === opt.value ? 'text-slate-800' : 'text-slate-700'}`}>
                  {opt.label}
                </div>
                {opt.desc && (
                  <div className="text-xs text-slate-400 leading-snug mt-0.5">{opt.desc}</div>
                )}
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

const PSF_OPTIONS: { value: PsfBand; label: string; dot?: string }[] = [
  { value: 'All',     label: 'Any Zone' },
  { value: 'budget',  label: 'Budget  < $600',   dot: '#059669' },
  { value: 'mid',     label: 'Mid  $600–750',     dot: '#d97706' },
  { value: 'premium', label: 'Premium  > $750',   dot: '#dc2626' },
]

// ── Mobile bottom sheet ────────────────────────────────────────────────────────

// Shared row components used inside the sheet
function SheetRadioRow<T extends string | number>({
  opt,
  selected,
  onSelect,
}: {
  opt: { value: T; label: string; dot?: string; stars?: string; desc?: string }
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left active:bg-slate-50"
    >
      <span className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
        selected ? 'border-slate-800' : 'border-slate-300'
      }`}>
        {selected && <span className="w-2 h-2 rounded-full bg-slate-800" />}
      </span>
      {opt.dot && (
        <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: opt.dot }} />
      )}
      <div className="flex-1 min-w-0">
        <div className={`leading-snug ${selected ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
          {opt.stars ? `${opt.stars} ` : ''}{opt.label}
        </div>
        {opt.desc && (
          <div className="text-xs text-slate-400 leading-snug mt-0.5">{opt.desc}</div>
        )}
      </div>
    </button>
  )
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pt-4 pb-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
      </div>
      {children}
      <div className="h-px bg-slate-100 mx-4 mt-2" />
    </div>
  )
}

function FilterBottomSheet({
  open,
  onClose,
  filters,
  onChange,
  resultCount,
}: {
  open: boolean
  onClose: () => void
  filters: Filters
  onChange: (f: Filters) => void
  resultCount: number
}) {
  // Lock body scroll while sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function set<K extends keyof Filters>(key: K, val: Filters[K]) {
    onChange({ ...filters, [key]: val })
  }

  const accessValue: PRColor | 'All' | 'emerging' =
    filters.emerging ? 'emerging' : filters.access

  function handleAccess(val: PRColor | 'All' | 'emerging') {
    if (val === 'emerging') {
      onChange({ ...filters, access: 'All', emerging: true })
    } else {
      onChange({ ...filters, access: val as PRColor | 'All', emerging: false })
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white rounded-t-2xl shadow-2xl
          transition-transform duration-300 ease-out max-h-[85vh]
          ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 shrink-0">
          <span className="text-base font-semibold text-slate-800">Filters</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
            aria-label="Close filters"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable filter sections */}
        <div className="flex-1 overflow-y-auto">

          {/* Region */}
          <SheetSection title="Region">
            {REGION_OPTIONS.map(opt => (
              <SheetRadioRow
                key={String(opt.value)}
                opt={opt}
                selected={filters.region === opt.value}
                onSelect={() => set('region', opt.value)}
              />
            ))}
          </SheetSection>

          {/* PR Access */}
          <SheetSection title="Got Chance for PR?">
            {ACCESS_OPTIONS.map(opt => (
              <SheetRadioRow
                key={String(opt.value)}
                opt={opt}
                selected={accessValue === opt.value}
                onSelect={() => handleAccess(opt.value)}
              />
            ))}
          </SheetSection>

          {/* Quality */}
          <SheetSection title="Quality">
            {QUALITY_OPTIONS.map(opt => (
              <SheetRadioRow
                key={String(opt.value)}
                opt={opt}
                selected={filters.tier === opt.value}
                onSelect={() => set('tier', opt.value as 1 | 2 | 3 | 'All')}
              />
            ))}
          </SheetSection>

          {/* Programmes */}
          <SheetSection title="Programmes">
            <button
              onClick={() => onChange({ ...filters, gep: false, sap: false, alp: false, ip: false })}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left active:bg-slate-50"
            >
              <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                !(filters.gep || filters.sap || filters.alp || filters.ip)
                  ? 'bg-slate-800 border-slate-800' : 'border-slate-300'
              }`}>
                {!(filters.gep || filters.sap || filters.alp || filters.ip) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span className={`flex-1 ${!(filters.gep || filters.sap || filters.alp || filters.ip) ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                All Programmes
              </span>
            </button>
            {PROG_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => onChange({ ...filters, [opt.key]: !filters[opt.key] })}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left active:bg-slate-50"
              >
                <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                  filters[opt.key] ? 'bg-slate-800 border-slate-800' : 'border-slate-300'
                }`}>
                  {filters[opt.key] && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className={`flex-1 ${filters[opt.key] ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                  {opt.label}
                </span>
                <span className="text-xs text-slate-400">{opt.desc}</span>
              </button>
            ))}
          </SheetSection>

          {/* Property Zone */}
          <SheetSection title="Property Zone">
            {PSF_OPTIONS.map(opt => (
              <SheetRadioRow
                key={String(opt.value)}
                opt={opt}
                selected={filters.psf === opt.value}
                onSelect={() => set('psf', opt.value)}
              />
            ))}
          </SheetSection>

          {/* Bottom padding so last item isn't hidden behind footer */}
          <div className="h-4" />
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-4 py-3 border-t border-slate-100 bg-white">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-800 text-white text-sm font-semibold active:bg-slate-700 transition-colors"
          >
            Show {resultCount} result{resultCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

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
  const [sheetOpen, setSheetOpen] = useState(false)
  const activeCount = useActiveFilterCount(filters)

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
    <>
      <div className="bg-white border-b border-slate-200 shadow-sm z-20 shrink-0">
        {/* ── Row 1: logo + search + count + view toggle ── */}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-bold text-slate-800 text-base tracking-tight shrink-0">
            PR School Hunt
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

        {/* ── Row 2: desktop — five pill dropdowns; mobile — single Filters button ── */}
        <div className="px-4 pb-2.5">

          {/* Mobile Filters button — hidden on md+ */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setSheetOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCount > 0
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              <SlidersHorizontal size={14} />
              {activeCount > 0 ? `Filters · ${activeCount}` : 'Filters'}
            </button>
            {/* Inline result count on mobile since sm: count is hidden when crowded */}
            <span className="text-xs text-slate-400 ml-1">
              {resultCount}/{total}
            </span>
          </div>

          {/* Desktop pill row — hidden below md */}
          <div className="hidden md:flex items-center gap-2">
            <SingleDropdown
              options={REGION_OPTIONS}
              value={filters.region}
              onChange={v => set('region', v)}
            />
            <AccessDropdown
              value={accessValue}
              onChange={handleAccess}
            />
            <QualityDropdown
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
      </div>

      {/* Mobile bottom sheet — portalled to document.body */}
      <FilterBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={onChange}
        resultCount={resultCount}
      />
    </>
  )
}
