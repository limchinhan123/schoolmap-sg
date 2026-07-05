import { supabase } from './supabase'
import type { DataVintage, School } from './types'

export async function fetchSchools(): Promise<School[]> {
  const { data, error } = await supabase
    .from('schools')
    .select(
      'id, name, address, region, gate_lat, gate_lng, is_autonomous, is_gep_centre, is_sap, is_ip_pipeline, alp_focus, affiliated_secondary, affiliated_sec_tier, pr_color, pr_label, pr_summary, pr_limited_data, quality_stars, avg_psf_1km'
    )
    .eq('level', 'Primary')
    .not('gate_lat', 'is', null)
    .order('name')

  if (error) throw new Error(`Failed to fetch schools: ${error.message}`)
  return (data ?? []) as School[]
}

/**
 * Resolve dataset freshness at build time so the UI can show it.
 * Best-effort: any failure just hides the caption rather than failing the build.
 */
export async function fetchDataVintage(): Promise<DataVintage> {
  const vintage: DataVintage = { ballotYearMin: null, ballotYearMax: null, propertyMax: null }

  try {
    const [ballotMin, ballotMax, hdbMax, condoMax] = await Promise.all([
      supabase.from('school_ballot_data').select('year').order('year', { ascending: true }).limit(1).maybeSingle(),
      supabase.from('school_ballot_data').select('year').order('year', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('hdb_transactions').select('transaction_date').order('transaction_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('condo_transactions').select('transaction_date').order('transaction_date', { ascending: false }).limit(1).maybeSingle(),
    ])

    vintage.ballotYearMin = ballotMin.data?.year ?? null
    vintage.ballotYearMax = ballotMax.data?.year ?? null

    const dates = [hdbMax.data?.transaction_date, condoMax.data?.transaction_date]
      .filter((d): d is string => !!d)
      .sort()
    if (dates.length > 0) {
      vintage.propertyMax = new Date(dates[dates.length - 1]).toLocaleDateString('en-SG', {
        month: 'short',
        year: 'numeric',
      })
    }
  } catch {
    // leave nulls — caption simply won't render
  }

  return vintage
}
