'use client'

import { X, AlertCircle, TrendingUp, MapPin, Calendar, Layers } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { School, NearbyProperty, BallotRound } from '@/lib/types'

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

/** Lease years → colour class (matches spec: 90+ 🟢 / 80-89 🟡 / 70-79 🟠 / 60-69 🔴 / <60 ⛔) */
function leaseColor(years: number | null): string {
  if (years == null) return 'bg-slate-100 text-slate-500'
  if (years >= 90) return 'bg-emerald-100 text-emerald-700'
  if (years >= 80) return 'bg-amber-100 text-amber-700'
  if (years >= 70) return 'bg-orange-100 text-orange-700'
  if (years >= 60) return 'bg-red-100 text-red-700'
  return 'bg-red-200 text-red-800'
}

/** Shorten URA tenure strings for display */
function fmtTenure(tenure: string | null): string | null {
  if (!tenure) return null
  if (/freehold/i.test(tenure)) return 'Freehold'
  if (/999/i.test(tenure)) return '999-yr leasehold'
  const m = tenure.match(/^(\d+)\s*yrs?/i)
  if (m) return `${m[1]}-yr leasehold`
  return tenure
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
  const tenureLabel = isHdb ? null : fmtTenure(p.tenure)

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 flex flex-col gap-2 shadow-sm">

      {/* ── Row 1: Type badge + property name + distance ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Prominent type badge */}
          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide ${
            isHdb
              ? 'bg-blue-100 text-blue-700'
              : 'bg-purple-100 text-purple-700'
          }`}>
            {isHdb ? 'HDB' : 'CONDO'}
          </span>
          <span className="text-xs font-semibold text-slate-700 truncate">{p.property_name}</span>
        </div>
        {/* Distance from gate */}
        <div className="flex items-center gap-1 shrink-0 text-xs text-slate-400">
          <MapPin size={11} className="shrink-0" />
          <span>{distLabel(p.distance_m)} from gate</span>
        </div>
      </div>

      {/* ── Row 2: Flat type · size · floor ── */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
        <span>{p.flat_type}</span>
        <span className="text-slate-300">·</span>
        <span>{Math.round(p.floor_area_sqft).toLocaleString()} sqft</span>
        {p.floor_level && (
          <>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-0.5">
              <Layers size={10} className="text-slate-400" />
              {p.floor_level}
            </span>
          </>
        )}
      </div>

      {/* ── Row 3: Lease / tenure badge ── */}
      {isHdb && p.remaining_lease_years != null ? (
        <div className="flex items-center gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${leaseColor(p.remaining_lease_years)}`}>
            {p.remaining_lease_years}yr lease remaining
          </span>
        </div>
      ) : !isHdb && tenureLabel ? (
        <div className="flex items-center gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            tenureLabel === 'Freehold' || tenureLabel === '999-yr leasehold'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {tenureLabel}
          </span>
        </div>
      ) : null}

      {/* ── Row 4: Price + PSF ── */}
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold text-slate-800">{fmt(p.resale_price)}</span>
        <span className="text-xs text-slate-500">{fmtPsf(p.psf)}/sqft</span>
      </div>

      {/* ── Row 5: ABSD + date ── */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-orange-600 font-medium">+{fmt(absd)} (5% ABSD for PRs)</span>
        <div className="flex items-center gap-1 text-slate-400">
          <Calendar size={11} />
          <span>{monthYear}</span>
        </div>
      </div>

    </div>
  )
}

// ── Ballot history ─────────────────────────────────────────────────────────────

const BALLOT_DESC: Record<string, string> = {
  no_ballot:  'Vacancies remained — no ballot needed',
  'PR<1':     'Ballot among PRs within 1km',
  'PR1-2':    'Ballot among PRs, 1–2km distance',
  'PR<2#':    'Ballot among PRs within 2km',
  'PR>2':     'Ballot among PRs beyond 2km',
  'SC<1':     'Ballot among SCs within 1km',
  'SC1-2':    'Ballot among SCs, 1–2km distance',
  'SC<2#':    'Ballot among SCs within 2km',
  'SC>2':     'Ballot among SCs beyond 2km',
  'SC#':      'Ballot among SCs',
}

/** Colour token for ballot_type pill */
function ballotColor(bt: string): string {
  if (bt === 'no_ballot')        return 'bg-green-50 text-green-700'
  if (bt.startsWith('PR'))       return 'bg-amber-50 text-amber-700'
  if (bt === 'SC<1' || bt === 'SC#') return 'bg-red-50 text-red-700'
  if (bt.startsWith('SC'))       return 'bg-orange-50 text-orange-700'
  return 'bg-slate-50 text-slate-600'
}

function BallotHistory({ schoolId }: { schoolId: string }) {
  const [rounds, setRounds] = useState<BallotRound[] | null>(null)

  useEffect(() => {
    setRounds(null)
    supabase
      .from('school_ballot_data')
      .select('year, ballot_type, phase2c_vacancies, phase2c_applicants, ballot_held, supplementary_triggered')
      .eq('school_id', schoolId)
      .order('year', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setRounds(data as BallotRound[])
      })
  }, [schoolId])

  if (rounds === null) {
    return <div className="h-16 rounded-lg bg-slate-50 animate-pulse mt-3" />
  }

  if (rounds.length === 0) {
    return <p className="text-xs text-slate-400 mt-3">No ballot history available.</p>
  }

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Year-by-Year History
      </p>
      {rounds.map(r => (
        <div
          key={r.year}
          className="flex items-start gap-2.5 py-2 px-3 rounded-lg bg-slate-50 text-xs"
        >
          {/* Year */}
          <span className="shrink-0 font-bold text-slate-700 w-9">{r.year}</span>

          {/* Ballot type pill */}
          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide ${ballotColor(r.ballot_type)}`}>
            {r.ballot_type}
          </span>

          {/* Description + flags */}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-slate-600 leading-snug">
              {BALLOT_DESC[r.ballot_type] ?? r.ballot_type}
            </p>
            <div className="flex flex-wrap gap-1">
              {r.supplementary_triggered && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-medium">
                  2C(S) triggered
                </span>
              )}
              {r.ballot_type === 'PR<1' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
                  PRs reached ballot queue
                </span>
              )}
              {r.ballot_type === 'SC<1' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium">
                  SCs within 1km oversubscribed
                </span>
              )}
              {r.ballot_type === 'SC>2' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-medium">
                  Only SCs beyond 2km competing
                </span>
              )}
              {r.ballot_type === 'no_ballot' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">
                  Vacancies remained
                </span>
              )}
            </div>
          </div>

          {/* Vacancies / applicants ratio */}
          {r.phase2c_vacancies != null && r.phase2c_applicants != null && (
            <div className="shrink-0 text-right text-[10px] text-slate-400 leading-snug">
              <div>{r.phase2c_applicants} applied</div>
              <div>{r.phase2c_vacancies} places</div>
            </div>
          )}
        </div>
      ))}
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

  // Zone median from pre-computed field (100 tx) or fallback to displayed 20
  const zonePsf = school.avg_psf_1km ?? (() => {
    const sorted = [...props.map(p => Number(p.psf))].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  })()

  const psfBandLabel = zonePsf < 600 ? 'Budget' : zonePsf < 750 ? 'Mid-range' : 'Premium'
  const psfBandColor = zonePsf < 600
    ? 'bg-emerald-50 text-emerald-700'
    : zonePsf < 750
    ? 'bg-amber-50 text-amber-700'
    : 'bg-red-50 text-red-700'

  return (
    <div className="space-y-3">
      {/* Zone PSF hero */}
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">1km Zone Median</p>
          <p className="text-2xl font-bold text-slate-800">{fmtPsf(zonePsf)}<span className="text-sm font-normal text-slate-400">/sqft</span></p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${psfBandColor}`}>
            {psfBandLabel}
          </span>
          <div className="flex gap-1.5">
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
      </div>

      {/* Subtitle */}
      <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
        <TrendingUp size={12} className="shrink-0" />
        <span>Recent transactions within 1km · sorted by date</span>
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
      className={`
        absolute bottom-0 left-0 right-0 z-30 transition-transform duration-300 ease-out
        md:relative md:bottom-auto md:left-auto md:right-auto
        md:w-96 md:flex-shrink-0 md:z-auto md:translate-y-0
        md:border-l md:border-slate-200
        ${visible ? 'translate-y-0' : 'translate-y-full md:hidden'}
      `}
      aria-hidden={!visible}
    >
      <div className="bg-white rounded-t-2xl shadow-2xl max-h-[70vh] md:max-h-none md:h-full md:rounded-none md:shadow-none overflow-y-auto">
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
                    <BallotHistory schoolId={school.id} />
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
