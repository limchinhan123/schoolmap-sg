/**
 * Compute median PSF (HDB + condo) within 1km for each school
 * and update schools.avg_psf_1km
 *
 * Run after HDB/condo ingestion is complete:
 *   npx tsx --env-file=.env.local scripts/compute-avg-psf.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

async function main() {
  // Fetch all schools with coordinates
  const { data: schools, error: schoolErr } = await supabase
    .from('schools')
    .select('id, name, gate_lat, gate_lng')
    .eq('level', 'Primary')
    .not('gate_lat', 'is', null)

  if (schoolErr || !schools) { console.error(schoolErr); process.exit(1) }
  console.log(`Computing PSF for ${schools.length} schools...`)

  let updated = 0
  for (const school of schools) {
    // Call the nearby_properties RPC
    const { data, error } = await supabase.rpc('nearby_properties', {
      school_lat: school.gate_lat,
      school_lng: school.gate_lng,
      radius_m: 1000,
      max_rows: 100,
    })

    if (error || !data || data.length === 0) {
      process.stdout.write('·')
      continue
    }

    // Compute median PSF
    const psfs = (data as Array<{ psf: number }>)
      .map(p => p.psf)
      .filter(p => p > 0)
      .sort((a, b) => a - b)

    if (psfs.length === 0) { process.stdout.write('·'); continue }
    const median = psfs[Math.floor(psfs.length / 2)]

    const { error: upErr } = await supabase
      .from('schools')
      .update({ avg_psf_1km: Math.round(median) })
      .eq('id', school.id)

    if (upErr) {
      process.stdout.write('✗')
    } else {
      process.stdout.write('✓')
      updated++
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\n\nUpdated ${updated}/${schools.length} schools with avg_psf_1km`)

  // Show distribution
  const { data: stats } = await supabase
    .from('schools')
    .select('avg_psf_1km')
    .not('avg_psf_1km', 'is', null)
  const psfs = (stats ?? []).map(s => s.avg_psf_1km as number).sort((a, b) => a - b)
  if (psfs.length > 0) {
    console.log(`PSF range: $${psfs[0]} – $${psfs[psfs.length - 1]}`)
    console.log(`Median: $${psfs[Math.floor(psfs.length / 2)]}`)
  }
}

main().catch(console.error)
