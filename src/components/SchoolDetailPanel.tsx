'use client'

import { X, AlertCircle } from 'lucide-react'
import type { School } from '@/lib/types'

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

export default function SchoolDetailPanel({
  school,
  onClose,
}: {
  school: School | null
  onClose: () => void
}) {
  const visible = !!school

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden={!visible}
    >
      <div className="bg-white rounded-t-2xl shadow-2xl max-h-[60vh] overflow-y-auto">
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

            <div className="px-5 pb-5 space-y-4">
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}
