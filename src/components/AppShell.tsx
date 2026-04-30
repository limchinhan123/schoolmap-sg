'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import type { Filters, School, SortDir, SortKey } from '@/lib/types'
import FilterBar from './FilterBar'
import SchoolDetailPanel from './SchoolDetailPanel'
import ListView from './ListView'

const MapView = dynamic(() => import('./MapView'), { ssr: false })

const DEFAULT_FILTERS: Filters = {
  region: 'All',
  access: 'All',
  tier: 'All',
  gep: false,
  sap: false,
  alp: false,
  ip: false,
  emerging: false,
  psf: 'All',
  search: '',
}

const PR_ORDER: Record<string, number> = { green: 0, amber: 1, orange: 2, grey: 3 }

export default function AppShell({ schools }: { schools: School[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<School | null>(null)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase().trim()
    return schools.filter(s => {
      if (filters.region !== 'All' && s.region !== filters.region) return false
      if (filters.access !== 'All' && s.pr_color !== filters.access) return false
      if (filters.tier !== 'All' && s.quality_stars !== filters.tier) return false
      if (filters.gep && !s.is_gep_centre) return false
      if (filters.sap && !s.is_sap) return false
      if (filters.alp && !s.alp_focus) return false
      if (filters.ip && !s.is_ip_pipeline) return false
      if (filters.emerging && !s.pr_limited_data) return false
      if (filters.psf === 'budget' && (s.avg_psf_1km == null || s.avg_psf_1km >= 600)) return false
      if (filters.psf === 'mid' && (s.avg_psf_1km == null || s.avg_psf_1km < 600 || s.avg_psf_1km >= 750)) return false
      if (filters.psf === 'premium' && (s.avg_psf_1km == null || s.avg_psf_1km < 750)) return false
      if (q && !s.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [schools, filters])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'region') cmp = a.region.localeCompare(b.region)
      else if (sortKey === 'pr_color') cmp = PR_ORDER[a.pr_color] - PR_ORDER[b.pr_color]
      else if (sortKey === 'quality_stars') cmp = a.quality_stars - b.quality_stars
      else if (sortKey === 'avg_psf_1km') cmp = (a.avg_psf_1km ?? 0) - (b.avg_psf_1km ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // PSF and tier sort most-useful first (high → low); others ascending
      setSortDir(key === 'avg_psf_1km' || key === 'quality_stars' ? 'desc' : 'asc')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        view={view}
        onViewChange={setView}
        resultCount={filtered.length}
        total={schools.length}
      />

      <div className="flex-1 relative overflow-hidden">
        {view === 'map' ? (
          <MapView
            schools={filtered}
            selected={selected}
            onSelect={setSelected}
          />
        ) : (
          <ListView
            schools={sorted}
            selected={selected}
            onSelect={setSelected}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
        )}

        <SchoolDetailPanel
          school={selected}
          onClose={() => setSelected(null)}
        />
      </div>
    </div>
  )
}
