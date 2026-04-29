/**
 * load-schools.ts
 * Parses Generalinformationofschools.csv and upserts primary schools into Supabase.
 *
 * Usage:
 *   npx tsx scripts/load-schools.ts /path/to/Generalinformationofschools.csv
 */

import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

// ─── Region mapping ───────────────────────────────────────────────────────────
// data.gov.sg only has 4 zone_codes. We derive "Central" from dgp_code.
const CENTRAL_DGP_CODES = new Set([
  'CENTRAL', 'NOVENA', 'QUEENSTOWN', 'TOA PAYOH', 'KALLANG', 'BISHAN',
])

function deriveRegion(zoneCode: string, dgpCode: string): string {
  if (zoneCode === 'SOUTH' && CENTRAL_DGP_CODES.has(dgpCode.toUpperCase())) {
    return 'Central'
  }
  const map: Record<string, string> = {
    NORTH: 'North',
    SOUTH: 'South',
    EAST: 'East',
    WEST: 'West',
  }
  return map[zoneCode] ?? zoneCode
}

// ─── Type mapping ─────────────────────────────────────────────────────────────
function deriveSchoolType(typeCode: string): string {
  const map: Record<string, string> = {
    'GOVERNMENT SCHOOL': 'Government',
    'GOVERNMENT-AIDED SCH': 'Government-Aided',
    'INDEPENDENT SCHOOL': 'Independent',
    'SPECIALISED SCHOOL': 'Specialised',
  }
  return map[typeCode] ?? typeCode
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/load-schools.ts <path-to-csv>')
    process.exit(1)
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Missing env vars. Run with: npx tsx --env-file=.env.local scripts/load-schools.ts <csv>')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  const raw = fs.readFileSync(path.resolve(csvPath), 'utf-8')
  const rows = parse(raw, { columns: true, skip_empty_lines: true })

  // Filter to primary schools only
  const primary = rows.filter((r: any) => r.mainlevel_code === 'PRIMARY')
  console.log(`Found ${primary.length} primary schools in CSV`)

  const records = primary.map((r: any) => ({
    name: r.school_name.trim(),
    address: r.address.trim() || null,
    postal_code: r.postal_code?.trim() || null,
    gate_lat: null,          // filled by geocoding script
    gate_lng: null,          // filled by geocoding script
    region: deriveRegion(r.zone_code, r.dgp_code),
    level: 'Primary',
    school_type: deriveSchoolType(r.type_code),
    is_autonomous: false,    // data.gov.sg omits this for primary; MOE scraper corrects later
    is_gep_centre: r.gifted_ind === 'Yes',
    is_sap: r.sap_ind === 'Yes',
    is_ip_pipeline: false,   // populated after affiliated secondary data is loaded
    alp_focus: null,         // not in CSV; populated in a later step
    affiliated_secondary: null,
    affiliated_sec_tier: null,
    phase2b_info_url: r.url_address?.trim() || null,
    data_source_notes: 'data.gov.sg — General Information of Schools',
    last_updated: new Date().toISOString(),
  }))

  // Upsert in batches of 50 (Supabase row limit per request)
  const BATCH = 50
  let inserted = 0
  let errors = 0

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const { error } = await supabase
      .from('schools')
      .upsert(batch, { onConflict: 'name' })

    if (error) {
      console.error(`Batch ${i / BATCH + 1} error:`, error.message)
      errors++
    } else {
      inserted += batch.length
      console.log(`Inserted batch ${i / BATCH + 1} (${inserted}/${records.length})`)
    }
  }

  console.log(`\nDone. ${inserted} schools inserted, ${errors} batch errors.`)

  // Print region breakdown for sanity check
  const { data: regions } = await supabase
    .from('schools')
    .select('region')
  const counts: Record<string, number> = {}
  for (const row of regions ?? []) {
    counts[row.region] = (counts[row.region] ?? 0) + 1
  }
  console.log('\nRegion breakdown:', counts)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
