/**
 * geocode-schools.ts
 * Fetches gate_lat / gate_lng for each school in Supabase via the OneMap API.
 * Updates schools where gate_lat IS NULL only (safe to re-run).
 *
 * OneMap API is free, official (SLA), and most accurate for Singapore addresses.
 * No API key required for the search endpoint.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/geocode-schools.ts
 *
 * After running, manually verify gate coordinates for large-campus schools
 * (e.g. ACS, Raffles Girls', Nanyang Primary) against satellite imagery —
 * OneMap may return the building centroid, not the main gate.
 */

import { createClient } from '@supabase/supabase-js'

const ONEMAP_SEARCH = 'https://www.onemap.gov.sg/api/common/elastic/search'
const RATE_LIMIT_MS = 300   // OneMap free tier: ~3 req/sec; 300ms gap is safe

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface OneMapResult {
  SEARCHVAL: string
  BLK_NO: string
  ROAD_NAME: string
  BUILDING: string
  ADDRESS: string
  POSTAL: string
  X: string
  Y: string
  LATITUDE: string
  LONGITUDE: string
}

async function geocodeAddress(address: string, postalCode: string | null): Promise<{ lat: number; lng: number; matched: string } | null> {
  // Try postal code first — most precise
  const queries = postalCode
    ? [postalCode, address]
    : [address]

  for (const query of queries) {
    const url = new URL(ONEMAP_SEARCH)
    url.searchParams.set('searchVal', query)
    url.searchParams.set('returnGeom', 'Y')
    url.searchParams.set('getAddrDetails', 'Y')
    url.searchParams.set('pageNum', '1')

    const res = await fetch(url.toString())
    if (!res.ok) continue

    const data = await res.json()
    const results: OneMapResult[] = data.results ?? []
    if (results.length === 0) continue

    const top = results[0]
    const lat = parseFloat(top.LATITUDE)
    const lng = parseFloat(top.LONGITUDE)

    if (isNaN(lat) || isNaN(lng)) continue

    return { lat, lng, matched: top.ADDRESS }
  }

  return null
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Missing env vars. Run: npx tsx --env-file=.env.local scripts/geocode-schools.ts')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  // Fetch schools with no gate coordinates yet
  const { data: schools, error } = await supabase
    .from('schools')
    .select('id, name, address, postal_code')
    .is('gate_lat', null)
    .order('name')

  if (error) {
    console.error('Failed to fetch schools:', error.message)
    process.exit(1)
  }

  console.log(`Found ${schools.length} schools to geocode\n`)

  let success = 0
  let failed = 0
  const failures: string[] = []

  for (const school of schools) {
    await sleep(RATE_LIMIT_MS)

    const result = await geocodeAddress(school.address, school.postal_code)

    if (!result) {
      console.warn(`  ✗ ${school.name} — no result`)
      failed++
      failures.push(school.name)
      continue
    }

    const { error: updateError } = await supabase
      .from('schools')
      .update({
        gate_lat: result.lat,
        gate_lng: result.lng,
        last_updated: new Date().toISOString(),
      })
      .eq('id', school.id)

    if (updateError) {
      console.warn(`  ✗ ${school.name} — update failed: ${updateError.message}`)
      failed++
      failures.push(school.name)
    } else {
      console.log(`  ✓ ${school.name} → ${result.lat}, ${result.lng}  (matched: ${result.matched})`)
      success++
    }
  }

  console.log(`\n✅ Geocoded ${success}/${schools.length} schools`)
  if (failures.length > 0) {
    console.log(`\n⚠️  Failed (${failures.length}) — geocode manually and UPDATE schools SET gate_lat=..., gate_lng=... WHERE name='...':`)
    for (const name of failures) console.log(`   - ${name}`)
  }

  console.log(`
⚠️  MANUAL VERIFICATION REQUIRED for large-campus schools.
   OneMap may return a building centroid rather than the main gate.
   Check the following against Google Maps satellite view:
   - ACS (Primary)
   - Raffles Girls' Primary School
   - Nanyang Primary School
   - Methodist Girls' School (Primary)
   - CHIJ St. Nicholas Girls' School
   - St. Joseph's Institution Junior
   Use: UPDATE schools SET gate_lat=<lat>, gate_lng=<lng> WHERE name='<name>';
  `)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
