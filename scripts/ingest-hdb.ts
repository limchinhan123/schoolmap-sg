/**
 * Ingest HDB resale transactions (last 24 months) from data.gov.sg
 * Geocodes via OneMap API, stores in hdb_transactions
 *
 * Run: npx tsx --env-file=.env.local scripts/ingest-hdb.ts
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const ONEMAP_KEY  = process.env.ONEMAP_API_KEY!
const HDB_RESOURCE = 'f1765b54-a209-4718-8d38-a39237f502b3'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Generate YYYY-MM strings for the last 24 months from today */
function last24Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months.reverse() // oldest first
}

interface HdbRecord {
  month: string
  town: string
  flat_type: string
  block: string
  street_name: string
  storey_range: string
  floor_area_sqm: string
  flat_model: string
  lease_commence_date: string
  remaining_lease: string
  resale_price: string
}

/** Fetch with retry and exponential backoff */
async function fetchWithRetry(url: string, maxRetries = 5): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url)
    if (res.status === 429) {
      const wait = Math.pow(2, attempt) * 2000 + Math.random() * 1000
      console.log(`\n  Rate limited, waiting ${Math.round(wait / 1000)}s...`)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    return res
  }
  throw new Error(`Failed after ${maxRetries} retries`)
}

/** Fetch all HDB records for a given month from data.gov.sg */
async function fetchMonth(month: string): Promise<HdbRecord[]> {
  const records: HdbRecord[] = []
  let offset = 0
  const limit = 5000  // large page to minimize request count

  while (true) {
    const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${HDB_RESOURCE}&filters={"month":"${month}"}&limit=${limit}&offset=${offset}`
    const res = await fetchWithRetry(url)
    if (!res.ok) throw new Error(`data.gov.sg error: ${res.status}`)
    const json = await res.json() as { result?: { records?: HdbRecord[]; total?: number } }
    const batch = json.result?.records ?? []
    records.push(...batch)
    if (records.length >= (json.result?.total ?? 0) || batch.length < limit) break
    offset += limit
    await new Promise(r => setTimeout(r, 1500))
  }
  return records
}

// Geocoding cache: "BLOCK STREET" → { lat, lng }
const geocodeCache = new Map<string, { lat: number; lng: number } | null>()
let geocodeCount = 0
let geocodeCacheHits = 0

/** Geocode a HDB address via OneMap API */
async function geocode(block: string, street: string): Promise<{ lat: number; lng: number } | null> {
  const key = `${block} ${street}`
  if (geocodeCache.has(key)) { geocodeCacheHits++; return geocodeCache.get(key)! }

  // OneMap rate limit: ~250 req/min → 240ms between each new geocode call
  await new Promise(r => setTimeout(r, 250))

  try {
    const searchVal = encodeURIComponent(key)
    const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${searchVal}&returnGeom=Y&getAddrDetails=Y&pageNum=1`
    const res = await fetch(url, {
      headers: { Authorization: ONEMAP_KEY },
    })
    if (!res.ok) { geocodeCache.set(key, null); return null }
    const json = await res.json() as { results?: Array<{ LATITUDE: string; LONGITUDE: string }> }
    const result = json.results?.[0]
    if (!result) { geocodeCache.set(key, null); return null }
    const coords = { lat: parseFloat(result.LATITUDE), lng: parseFloat(result.LONGITUDE) }
    geocodeCache.set(key, coords)
    geocodeCount++
    return coords
  } catch {
    geocodeCache.set(key, null)
    return null
  }
}

/** Extract storey midpoint from "01 TO 03" → 2 */
function storeyMid(range: string): number {
  const m = range.match(/(\d+)\s+TO\s+(\d+)/i)
  if (!m) return 5
  return Math.round((parseInt(m[1]) + parseInt(m[2])) / 2)
}

/** Calculate remaining lease years from lease_commence_date */
function remainingLease(leaseCommenceDate: string): number {
  const startYear = parseInt(leaseCommenceDate)
  const endYear = startYear + 99
  return endYear - new Date().getFullYear()
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing env vars. Run: npx tsx --env-file=.env.local scripts/ingest-hdb.ts')
    process.exit(1)
  }

  const months = last24Months()
  console.log(`Fetching ${months.length} months: ${months[0]} → ${months[months.length - 1]}`)

  // Check how many records already exist
  const { count: existingCount } = await supabase
    .from('hdb_transactions')
    .select('*', { count: 'exact', head: true })
  console.log(`Existing records: ${existingCount ?? 0}`)

  // Clear existing data for clean re-run
  if ((existingCount ?? 0) > 0) {
    console.log('Clearing existing hdb_transactions...')
    await supabase.from('hdb_transactions').delete().not('id', 'is', null)
  }

  let totalInserted = 0
  let totalFetched = 0

  for (const month of months) {
    process.stdout.write(`  ${month}... `)
    const records = await fetchMonth(month)
    totalFetched += records.length
    process.stdout.write(`${records.length} records, geocoding... `)

    const batch: object[] = []

    for (const r of records) {
      const coords = await geocode(r.block.trim(), r.street_name.trim())

      const floorAreaSqm = parseFloat(r.floor_area_sqm)
      const floorAreaSqft = floorAreaSqm * 10.7639
      const price = parseInt(r.resale_price)
      const psf = price / floorAreaSqft

      batch.push({
        block: r.block.trim(),
        street_name: r.street_name.trim(),
        flat_type: r.flat_type,
        storey_range: r.storey_range,
        floor_area_sqm: floorAreaSqm,
        floor_area_sqft: Math.round(floorAreaSqft),
        resale_price: price,
        psf: Math.round(psf),
        transaction_date: `${r.month}-01`,  // YYYY-MM-01
        remaining_lease_years: remainingLease(r.lease_commence_date),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        geocoded: !!coords,
        last_updated: new Date().toISOString(),
      })
    }

    // Upsert in chunks of 500 (ignore duplicates via onConflict)
    for (let i = 0; i < batch.length; i += 500) {
      const chunk = batch.slice(i, i + 500)
      const { error, count } = await supabase
        .from('hdb_transactions')
        .upsert(chunk, {
          onConflict: 'block,street_name,transaction_date,flat_type,storey_range,resale_price',
          ignoreDuplicates: true,
        })
        .select('id', { count: 'exact', head: true })
      if (error) console.error(`\n  Upsert error for ${month}:`, error.message)
      else totalInserted += count ?? chunk.length
    }

    console.log(`done (cache hits: ${geocodeCacheHits})`)
    geocodeCacheHits = 0
    await new Promise(r => setTimeout(r, 2000)) // 2s between months
  }

  console.log(`\n✅ Total fetched: ${totalFetched}, inserted: ${totalInserted}`)
  console.log(`   Unique addresses geocoded: ${geocodeCount}`)

  // Verify
  const { count: finalCount } = await supabase
    .from('hdb_transactions')
    .select('*', { count: 'exact', head: true })
  console.log(`   Final row count in DB: ${finalCount}`)
}

main().catch(console.error)
