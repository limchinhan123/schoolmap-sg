'use client'

import { X, AlertCircle, Home, Building2, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { School, NearbyProperty } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const COLOR_BG: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  orange: 'bg-orange-100 text-orange-800',
  grey: 'bg-violet-100 text-violet-900',
}
const COLOR_DOT: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  grey: 'bg-violet-900',
}

function Stars({ n }: { n: 1 | 2 | 3 }) {
  return (
    <span className="text-amber-400 text-base tracking-tight">
      {'★'.repeat(n)}
      <span className="text-slate-200">{'★'.repeat(3 - n)}</span>
    </span>
  )
}

/** Lease years → colour class for the badge */
function leaseColor(years: number | null): string {
  if (years == null) return 'bg-slate-100 text-slate-500'
  if (years >= 70) return 'bg-emerald-100 text-emerald-700'
  if (years >= 50) return 'bg-amber-100 text-amber-700'
  if (years >= 30) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

function fmt(n: number): string {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${(n / 1000).toFixed(0)}k`
}

function fmtPsf(n: number): string {
  return `$${Math.round(n).toLocaleString()}`
}

function distLabel(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
}

// ── Property Card ──────────────────────────────────────────────────────────────

function PropertyCard({ p }: { p: NearbyProperty }) {
  const absd = Math.round(p.resale_price * 0.05)
  const monthYear = new Date(p.transaction_date).toLocaleDateString('en-SG', {
    month: 'short', year: 'numeric',
  })
  const isHdb = p.source === 'hdb'

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 flex flex-col gap-1.5 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isHdb
            ? <Home size={13} className="text-slate-400 shrink-0" />
            : <Building2 size={13} className="text-slate-400 shrink-0" />}
          <span className="text-xs font-semibold text-slate-700 truncate">{p.property_name}</span>
        </div>
        <span className="text-xs text-slate-400 shrink-0">{distLabel(p.distance_m)}</span>
      </div>

      {/* Type + area row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">{p.flat_type}</span>
        <span className="text-slate-300">·</span>
        <span className="text-xs text-slate-500">{Math.round(p.floor_area_sqft).toLocaleString()} sqft</span>
        {isHdb && p.remaining_lease_years != null && (
          <>
            <span className="text-slate-300">·</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${leaseColor(p.remaining_lease_years)}`}>
              {p.remaining_lease_years}yr lease
            </span>
          </>
        )}
      </div>

      {/* Price row */}
      <div className="flex items-baseline justify-between mt-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-slate-800">{fmt(p.resale_price)}</span>
          <span className="text-xs text-slate-500">{fmtPsf(p.psf)}/sqft</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-orange-600 font-medium">+{fmt(absd)} ABSD</span>
          <span className="text-xs text-slate-400 ml-1.5">{monthYear}</span>
        </div>
      </div>
    </div>
  )
}

// ── Property Section ───────────────────────────────────────────────────────────

function PropertySection({ school }: { school: School }) {
  const [props, setProps] = useState<NearbyProperty[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setProps(null)

    supabase.rpc('nearby_properties', {
      school_lat: school.gate_lat,
      school_lng: school.gate_lng,
      radius_m: 1000,
      max_rows: 20,
    }).then(({ data, error }) => {
      if (!error && data) setProps(data as NearbyProperty[])
      setLoading(false)
    })
  }, [school.id])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!props || props.length === 0) {
    return (
      <p className="text-xs text-slate-400 py-4 text-center">No recent transactions within 1km</p>
    )
  }

  // Compute summary stats
  const hdbProps = props.filter(p => p.source === 'hdb')
  const condoProps = props.filter(p => p.source === 'condo')
  const allPsf = props.map(p => p.psf)
  const medPsf = allPsf.sort((a, b) => a - b)[Math.floor(allPsf.length / 2)]

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 text-xs bg-slate-50 rounded-lg px-3 py-2">
        <TrendingUp size={13} className="text-slate-400 shrink-0" />
        <span className="text-slate-500">
          {props.length} transactions · Median {fmtPsf(medPsf)}/sqft
        </span>
        <div className="flex gap-1.5 ml-auto">
          {hdbProps.length > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
              {hdbProps.length} HDB
            </span>
          )}
          {condoProps.length > 0 && (
            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">
              {condoProps.length} Condo
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {props.map((p, i) => (
          <PropertyCard key={i} p={p} />
        ))}
      </div>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function SchoolDetailPanel({
  school,
  onClose,
}: {
  school: School | null
  onClose: () => void
}) {
  const visible = !!school
  const [showProperties, setShowProperties] = useState(false)

  // Reset properties tab when school changes
  useEffect(() => {
    setShowProperties(false)
  }, [school?.id])

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden={!visible}
    >
      <div className="bg-white rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto">
        {school && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-slate-800 leading-snug">
                  {school.name.replace(/ PRIMARY SCHOOL$/, '').replace(/ SCHOOL$/, '').replace(/ \(PRIMARY\)$/, '')}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-medium uppercase tracking-wide">
                  {school.region} · Primary School
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drag handle */}
            <div className="mx-auto w-10 h-1 bg-slate-200 rounded-full mb-1" style={{ marginTop: '-8px' }} />

            {/* Tab bar */}
            <div className="flex border-b border-slate-100 px-5 gap-4">
              <button
                onClick={() => setShowProperties(false)}
                className={`pb-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                  !showProperties
                    ? 'border-slate-800 text-slate-800'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                School
              </button>
              <button
                onClick={() => setShowProperties(true)}
                className={`pb-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                  showProperties
                    ? 'border-slate-800 text-slate-800'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Nearby Properties
              </button>
            </div>

            <div className="px-5 pb-5 pt-4 space-y-4">
              {!showProperties ? (
                <>
                  {/* PR Accessibility */}
                  <div className="rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          COLOR_BG[school.pr_color]
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${COLOR_DOT[school.pr_color]}`} />
                        {school.pr_label}
                      </span>
                      {school.pr_limited_data && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                          <AlertCircle size={12} />
                          Limited data
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{school.pr_summary}</p>
                  </div>

                  {/* School Quality */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">School Quality</p>
                      <Stars n={school.quality_stars} />
                    </div>
                    {school.affiliated_secondary && (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Affiliated Secondary</p>
                        <p className="text-sm text-slate-700 font-medium">{school.affiliated_secondary}</p>
                      </div>
                    )}
                  </div>

                  {/* Special Programmes */}
                  {(school.is_gep_centre || school.is_sap || school.alp_focus || school.is_ip_pipeline || school.is_autonomous) && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Programmes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {school.is_autonomous && (
                          <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full border border-purple-100">
                            Autonomous
                          </span>
                        )}
                        {school.is_gep_centre && (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100">
                            GEP Centre
                          </span>
                        )}
                        {school.is_sap && (
                          <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full border border-red-100">
                            SAP
                          </span>
                        )}
                        {school.is_ip_pipeline && (
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
                            IP Pipeline
                          </span>
                        )}
                        {school.alp_focus && (
                          <span className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full border border-teal-100">
                            ALP · {school.alp_focus}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Address */}
                  <p className="text-xs text-slate-400">{school.address}</p>
                </>
              ) : (
                <PropertySection school={school} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
