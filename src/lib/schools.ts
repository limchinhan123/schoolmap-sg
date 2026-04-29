import { createClient } from '@supabase/supabase-js'
import type { School } from './types'

export async function fetchSchools(): Promise<School[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  const { data, error } = await supabase
    .from('schools')
    .select(
      'id, name, address, region, gate_lat, gate_lng, is_autonomous, is_gep_centre, is_sap, is_ip_pipeline, alp_focus, affiliated_secondary, affiliated_sec_tier, pr_color, pr_label, pr_summary, pr_limited_data, quality_stars'
    )
    .eq('level', 'Primary')
    .not('gate_lat', 'is', null)
    .order('name')

  if (error) throw new Error(`Failed to fetch schools: ${error.message}`)
  return (data ?? []) as School[]
}
