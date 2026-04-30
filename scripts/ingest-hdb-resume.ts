/**
 * Resume HDB ingestion for months not yet in the DB
 * Does NOT clear existing data — just appends missing months
 *
 * Run: npx tsx --env-file=.env.local scripts/ingest-hdb-resume.ts
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const ONEMAP_KEY  = process.env.ONEMAP_API_KEY!
const HDB_RESOURCE = 'f1765b54-a209-4718-8d38-a39237f502b3'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function last24Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months.reverse()
}

interface HdbRecord {
  month: string; town: string; flat_type: string; block: string
  street_name: string; storey_range: string; floor_area_sqm: string
  flat_model: string; lease_commence_date: string
  remaining_lease: string; resale_price: string
}

async function fetchWithRetry(url: string, maxRetries = 7): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url)
    if (res.status === 429) {
      const wait = Math.pow(2, attempt) * 3000 + Math.random() * 2000
      console.log(`\n  Rate limited, waiting ${Math.round(wait / 1000)}s...`)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    return res
  }
  throw new Error(`Failed after ${maxRetries} retries`)
}

async function fetchMonth(month: string): Promise<HdbRecord[]> {
  const records: HdbRecord[] = []
  let offset = 0
  const limit = 5000

  while (true) {
    const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${HDB_RESOURCE}&filters={"month":"${month}"}&limit=${limit}&offset=${offset}`
    const res = await fetchWithRetry(url)
    if (!res.ok) throw new Error(`data.gov.sg error: ${res.status}`)
    const json = await res.json() as { result?: { records?: HdbRecord[]; total?: number } }
    const batch = json.result?.records ?? []
    records.push(...batch)
    if (records.length >= (json.result?.total ?? 0) || batch.length < limit) break
    offset += limit
    await new Promise(r => setTimeout(r, 2000))
  }
  return records
}

const geocodeCache = new Map<string, { lat: number; lng: number } | null>()
let geocodeCount = 0

async function geocode(block: string, street: string): Promise<{ lat: number; lng: number } | null> {
  const key = `${block} ${street}`
  if (geocodeCache.has(key)) return geocodeCache.get(key)!
  await new Promise(r => setTimeout(r, 260))
  try {
    const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(key)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`
    const res = await fetch(url, { headers: { Authorization: ONEMAP_KEY } })
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

function storeyMid(range: string): number {
  const m = range.match(/(\d+)\s+TO\s+(\d+)/i)
  return m ? Math.round((parseInt(m[1]) + parseInt(m[2])) / 2) : 5
}

function remainingLease(leaseCommenceDate: string): number {
  return parseInt(leaseCommenceDate) + 99 - new Date().getFullYear()
}

async function main() {
  const months = last24Months()

  // Find which months already have data
  console.log('Checking existing months...')
  const existing = new Set<string>()
  for (const m of months) {
    const { count } = await supabase
      .from('hdb_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_date', `${m}-01`)
    if ((count ?? 0) > 100) {
      existing.add(m)
      console.log(`  ${m}: ${count} rows (skip)`)
    } else {
      console.log(`  ${m}: ${count ?? 0} rows (need)`)
    }
  }

  const missing = months.filter(m => !existing.has(m))
  console.log(`\nWill fetch ${missing.length} months: ${missing.join(', ')}\n`)

  let totalInserted = 0

  for (const month of missing) {
    process.stdout.write(`  ${month}... `)
    let records: HdbRecord[]
    try {
      records = await fetchMonth(month)
    } catch (e: unknown) {
      console.log(`SKIP (${(e as Error).message})`)
      await new Promise(r => setTimeout(r, 5000))
      continue
    }

    if (records.length === 0) {
      console.log('0 records (no data)')
      await new Promise(r => setTimeout(r, 2000))
      continue
    }

    process.stdout.write(`${records.length} records, geocoding... `)

    const batch: object[] = []
    for (const r of records) {
      const coords = await geocode(r.block.trim(), r.street_name.trim())
      const floorAreaSqm = parseFloat(r.floor_area_sqm)
      const floorAreaSqft = floorAreaSqm * 10.7639
      const price = parseInt(r.resale_price)
      batch.push({
        block: r.block.trim(),
        street_name: r.street_name.trim(),
        flat_type: r.flat_type,
        storey_range: r.storey_range,
        floor_area_sqm: floorAreaSqm,
        floor_area_sqft: Math.round(floorAreaSqft),
        resale_price: price,
        psf: Math.round(price / floorAreaSqft),
        transaction_date: `${r.month}-01`,
        remaining_lease_years: remainingLease(r.lease_commence_date),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        geocoded: !!coords,
        last_updated: new Date().toISOString(),
      })
    }

    for (let i = 0; i < batch.length; i += 500) {
      const chunk = batch.slice(i, i + 500)
      const { error, count } = await supabase
        .from('hdb_transactions')
        .insert(chunk)
        .select('id', { count: 'exact', head: true })
      if (error) console.error(`\n  Insert error: ${error.message}`)
      else totalInserted += count ?? chunk.length
    }

    console.log(`done`)
    await new Promise(r => setTimeout(r, 3000))
  }

  const { count: finalCount } = await supabase
    .from('hdb_transactions')
    .select('*', { count: 'exact', head: true })
  console.log(`\n✅ Inserted ${totalInserted} new rows. Total in DB: ${finalCount}`)
  console.log(`   Unique addresses geocoded this run: ${geocodeCount}`)
}

main().catch(console.error)
