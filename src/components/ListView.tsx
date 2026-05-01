'use client'

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { School, SortDir, SortKey } from '@/lib/types'

function psfColor(psf: number): string {
  if (psf < 550) return 'text-emerald-600'
  if (psf < 700) return 'text-amber-600'
  if (psf < 850) return 'text-orange-600'
  return 'text-red-600'
}

function psfColorSelected(psf: number): string {
  if (psf < 550) return 'text-emerald-300'
  if (psf < 700) return 'text-amber-300'
  if (psf < 850) return 'text-orange-300'
  return 'text-red-300'
}

type ProgBadge = { label: string; bg: string; text: string }
const PROG_BADGES: Record<string, ProgBadge> = {
  gep: { label: 'GEP', bg: 'bg-violet-100', text: 'text-violet-700' },
  sap: { label: 'SAP', bg: 'bg-sky-100',    text: 'text-sky-700'    },
  alp: { label: 'ALP', bg: 'bg-teal-100',   text: 'text-teal-700'  },
  ip:  { label: 'IP',  bg: 'bg-rose-100',   text: 'text-rose-700'  },
}

function ProgBadges({ school, selected }: { school: School; selected: boolean }) {
  const badges: ProgBadge[] = []
  if (school.is_gep_centre) badges.push(PROG_BADGES.gep)
  if (school.is_sap)        badges.push(PROG_BADGES.sap)
  if (school.alp_focus)     badges.push(PROG_BADGES.alp)
  if (school.is_ip_pipeline) badges.push(PROG_BADGES.ip)
  if (badges.length === 0) return <span className={selected ? 'text-slate-500' : 'text-slate-300'}>—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map(b => (
        <span
          key={b.label}
          className={`inline-block px-1 py-0.5 rounded text-[10px] font-semibold leading-none ${
            selected ? 'bg-slate-700 text-slate-200' : `${b.bg} ${b.text}`
          }`}
        >
          {b.label}
        </span>
      ))}
    </span>
  )
}

const COLOR_DOT: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  grey: 'bg-violet-900',
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={13} className="text-slate-300" />
  return dir === 'asc' ? (
    <ChevronUp size={13} className="text-slate-600" />
  ) : (
    <ChevronDown size={13} className="text-slate-600" />
  )
}

function Th({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (k: SortKey) => void
  className?: string
}) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-800 transition-colors ${className ?? ''}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon active={currentKey === sortKey} dir={currentDir} />
      </span>
    </th>
  )
}

export default function ListView({
  schools,
  selected,
  onSelect,
  sortKey,
  sortDir,
  onSort,
}: {
  schools: School[]
  selected: School | null
  onSelect: (s: School | null) => void
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
}) {
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
          <tr>
            <Th label="School" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={onSort} className="w-auto" />
            <Th label="Region" sortKey="region" currentKey={sortKey} currentDir={sortDir} onSort={onSort} className="w-28 hidden sm:table-cell" />
            <Th label="Access" sortKey="pr_color" currentKey={sortKey} currentDir={sortDir} onSort={onSort} className="w-36" />
            <Th label="Tier" sortKey="quality_stars" currentKey={sortKey} currentDir={sortDir} onSort={onSort} className="w-20" />
            <Th label="Progs" sortKey="programmes" currentKey={sortKey} currentDir={sortDir} onSort={onSort} className="w-28" />
            <Th label="PSF 1km" sortKey="avg_psf_1km" currentKey={sortKey} currentDir={sortDir} onSort={onSort} className="w-24 hidden sm:table-cell" />
          </tr>
        </thead>
        <tbody>
          {schools.map((school, i) => {
            const isSelected = selected?.id === school.id
            const shortName = school.name
              .replace(/ PRIMARY SCHOOL$/, '')
              .replace(/ SCHOOL$/, '')
              .replace(/ \(PRIMARY\)$/, '')
            return (
              <tr
                key={school.id}
                onClick={() => onSelect(isSelected ? null : school)}
                className={`cursor-pointer border-b border-slate-100 transition-colors ${
                  isSelected
                    ? 'bg-slate-800 text-white'
                    : i % 2 === 0
                    ? 'bg-white hover:bg-slate-50'
                    : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                      {shortName}
                    </span>
                    <span className={`text-xs sm:hidden mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {school.region}
                      {school.avg_psf_1km && (
                        <span className={`ml-2 font-medium ${isSelected ? psfColorSelected(school.avg_psf_1km) : psfColor(school.avg_psf_1km)}`}>
                          ${school.avg_psf_1km.toLocaleString()} psf
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td className={`px-4 py-3 text-sm hidden sm:table-cell ${isSelected ? 'text-slate-200' : 'text-slate-600'}`}>
                  {school.region}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${COLOR_DOT[school.pr_color]}`}
                    />
                    <span className={isSelected ? 'text-slate-100' : 'text-slate-700'}>
                      {school.pr_label}
                    </span>
                  </span>
                </td>
                <td className={`px-4 py-3 text-sm ${isSelected ? 'text-amber-300' : 'text-amber-400'}`}>
                  {'★'.repeat(school.quality_stars)}
                </td>
                <td className="px-4 py-3">
                  <ProgBadges school={school} selected={isSelected} />
                </td>
                <td className={`px-4 py-3 text-sm font-medium hidden sm:table-cell ${isSelected ? (school.avg_psf_1km ? psfColorSelected(school.avg_psf_1km) : 'text-slate-500') : school.avg_psf_1km ? psfColor(school.avg_psf_1km) : 'text-slate-300'}`}>
                  {school.avg_psf_1km ? `$${school.avg_psf_1km.toLocaleString()}` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {schools.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <p className="text-base font-medium">No schools match</p>
          <p className="text-sm mt-1">Try adjusting the filters above</p>
        </div>
      )}

      <div className="py-4 text-center text-xs text-slate-400">
        {schools.length} school{schools.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
