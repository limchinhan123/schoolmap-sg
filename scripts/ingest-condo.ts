/**
 * Ingest URA private residential (condo/apartment) transactions
 * into the condo_transactions table.
 *
 * Data source: URA Data Service v1 — PMI_Resi_Transaction
 *   Token:  GET https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1
 *           Header: AccessKey: <key>  →  response.Result contains token
 *   Data:   GET https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1
 *           ?service=PMI_Resi_Transaction&batch=<1-4>
 *           Headers: AccessKey + Token
 *   Coords: URA provides SVY21 x/y; converted to WGS84 inline (no API needed).
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... npx tsx --env-file=.env.local scripts/ingest-condo.ts
 *
 * Fetches all 4 batches (≈5 yrs of data), filters to last 18 months,
 * skips months already in DB (≥50 rows).
 * Only ingests non-landed Strata types: Condominium, Apartment, Executive Condominium.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jekmiqmjqebyzoidfgry.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_3iba6WVpWBm6bjwBnOAPHg_GPcC_L-r'
const URA_ACCESS_KEY = process.env.URA_ACCESS_KEY || 'fdc82fb5-0057-4778-ac21-f3ba94b701f7'

const ALLOWED_TYPES = new Set(['Condominium', 'Apartment', 'Executive Condominium'])
const BATCH_SIZE = 300
const MONTHS_BACK = 18

// ── SVY21 → WGS84 conversion (Cassini-Soldner inverse) ────────────────────────
// Based on: https://github.com/cgcai/SVY21
// No external API needed — pure math for Singapore coordinates.

function svy21ToWgs84(easting: number, northing: number): { lat: number; lng: number } {
  const a = 6378137.0                          // WGS84 semi-major axis
  const f = 1 / 298.257223563                  // WGS84 flattening
  // SVY21 origin: N1°22'02.9154"  E103°49'31.9735"
  const oLat0 = (1 + 22/60 + 2.9154/3600) * Math.PI / 180
  const oLng0 = (103 + 49/60 + 31.9735/3600) * Math.PI / 180
  const FE = 28001.642                         // false easting
  const FN = 38744.572                         // false northing

  const b   = a * (1 - f)
  const e2  = 1 - (b * b) / (a * a)
  const e4  = e2 * e2, e6 = e4 * e2

  const A0 = 1 - e2/4 - 3*e4/64 - 5*e6/256
  const A2 = 3/8 * (e2 + e4/4 + 15*e6/128)
  const A4 = 15/256 * (e4 + 3*e6/4)
  const A6 = 35*e6/3072
  const calcM = (lat: number) =>
    a * (A0*lat - A2*Math.sin(2*lat) + A4*Math.sin(4*lat) - A6*Math.sin(6*lat))

  const M0 = calcM(oLat0)
  const mu  = (northing - FN + M0) / (a * A0)

  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const J1 = 3*e1/2 - 27*e1**3/32
  const J2 = 21*e1**2/16 - 55*e1**4/32
  const J3 = 151*e1**3/96
  const J4 = 1097*e1**4/512
  const fp = mu + J1*Math.sin(2*mu) + J2*Math.sin(4*mu) + J3*Math.sin(6*mu) + J4*Math.sin(8*mu)

  const e2n = e2 / (1 - e2)
  const C1  = e2n * Math.cos(fp)**2
  const T1  = Math.tan(fp)**2
  const R1  = a*(1-e2) / (1 - e2*Math.sin(fp)**2)**1.5
  const N1  = a / Math.sqrt(1 - e2*Math.sin(fp)**2)
  const D   = (easting - FE) / N1

  const lat = fp - (N1*Math.tan(fp)/R1) * (
    D**2/2 -
    (5 + 3*T1 + 10*C1 - 4*C1**2 - 9*e2n)*D**4/24 +
    (61 + 90*T1 + 298*C1 + 45*T1**2 - 252*e2n - 3*C1**2)*D**6/720
  )
  const lng = oLng0 + (
    D - (1 + 2*T1 + C1)*D**3/6 +
    (5 - 2*C1 + 28*T1 - 3*C1**2 + 8*e2n + 24*T1**2)*D**5/120
  ) / Math.cos(fp)

  return { lat: lat * 180/Math.PI, lng: lng * 180/Math.PI }
}

// ── URA API ────────────────────────────────────────────────────────────────────

async function getUraToken(): Promise<string> {
  const res = await fetch(
    'https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1',
    { headers: { AccessKey: URA_ACCESS_KEY } }
  )
  if (!res.ok) throw new Error(`URA token request failed: ${res.status}`)
  const data = await res.json()
  if (data.Status !== 'Success') throw new Error(`URA token error: ${JSON.stringify(data)}`)
  return data.Result as string
}

interface UraTransaction {
  area: string            // sqm
  floorRange: string      // e.g. "01-05"
  noOfUnits: string
  contractDate: string    // MMYY e.g. "0126" = Jan 2026
  typeOfSale: string      // "1"=New, "2"=Sub, "3"=Resale
  price: string           // SGD
  propertyType: string    // "Condominium" | "Apartment" | ...
  district: string
  typeOfArea: string      // "Strata" | "Land"
  tenure: string
}

interface UraProject {
  project: string
  street: string
  x?: string              // SVY21 easting (may be missing for some entries)
  y?: string              // SVY21 northing
  transaction: UraTransaction[]
  marketSegment?: string
}

async function fetchBatch(token: string, batch: 1 | 2 | 3 | 4): Promise<UraProject[]> {
  const url = `https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1?service=PMI_Resi_Transaction&batch=${batch}`
  const res = await fetch(url, {
    headers: { AccessKey: URA_ACCESS_KEY, Token: token },
  })
  if (!res.ok) throw new Error(`URA batch ${batch} failed: ${res.status}`)
  const data = await res.json()
  if (data.Status !== 'Success') {
    console.warn(`  Non-success for batch ${batch}: ${data.Status}`)
    return []
  }
  return (data.Result as UraProject[]) ?? []
}

// ── Lease parser ───────────────────────────────────────────────────────────────

function parseRemainingLease(tenure: string, contractDateMMYY: string): number | null {
  if (!tenure || /freehold|999/i.test(tenure)) return null
  const m = tenure.match(/(\d+)\s*yrs?\s*lease\s*commencing\s*from\s*(\d{4})/i)
  if (!m) return null
  const totalYears = parseInt(m[1])
  const startYear  = parseInt(m[2])
  // contractDate "MMYY" e.g. "0126" → year 2026
  const txYear = 2000 + parseInt(contractDateMMYY.slice(2, 4))
  const remaining = totalYears - (txYear - startYear)
  return remaining > 0 ? remaining : 0
}

// ── Date helpers ───────────────────────────────────────────────────────────────

/** "MMYY" → ISO date "YYYY-MM-01" or null */
function parseContractDate(mmyy: string): string | null {
  if (!mmyy || mmyy.length < 4) return null
  const mm   = mmyy.slice(0, 2)
  const year = 2000 + parseInt(mmyy.slice(2, 4))
  if (isNaN(year) || parseInt(mm) < 1 || parseInt(mm) > 12) return null
  return `${year}-${mm}-01`
}

/** Returns MMYY key e.g. "0424" for month n months before now */
function monthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  return `${mm}${yy}`
}

/** ISO date "YYYY-MM-01" → MMYY key */
function isoToMmyy(iso: string): string {
  const d  = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  return `${mm}${yy}`
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  console.log('Getting URA token...')
  const token = await getUraToken()
  console.log('Token obtained.\n')

  // Build set of MMYY keys we want (last 18 months)
  const wantedMonths = new Set<string>()
  for (let i = 0; i < MONTHS_BACK; i++) wantedMonths.add(monthsAgo(i))
  console.log(`Target months (${wantedMonths.size}): ${[...wantedMonths].sort().join(', ')}`)

  // Check existing DB coverage
  const { data: existing } = await supabase
    .from('condo_transactions')
    .select('transaction_date')

  const monthCounts: Record<string, number> = {}
  for (const row of existing ?? []) {
    if (!row.transaction_date) continue
    const key = isoToMmyy(row.transaction_date)
    monthCounts[key] = (monthCounts[key] ?? 0) + 1
  }

  const needFetch = [...wantedMonths].filter(k => (monthCounts[k] ?? 0) < 50)
  console.log(`\nMonths needing data: ${needFetch.length} (${needFetch.sort().join(', ')})`)

  if (needFetch.length === 0) {
    console.log('All months already have sufficient data. Done.')
    return
  }

  const needSet = new Set(needFetch)

  // Fetch all 4 batches
  console.log('\nFetching URA batches 1–4...')
  const allProjects: UraProject[] = []
  for (const batch of [1, 2, 3, 4] as const) {
    process.stdout.write(`  batch ${batch}...`)
    const projects = await fetchBatch(token, batch)
    console.log(` ${projects.length} projects`)
    allProjects.push(...projects)
    await new Promise(r => setTimeout(r, 300))
  }
  console.log(`Total projects across all batches: ${allProjects.length}`)

  // Build rows for needed months, deduplicating projects across batches
  const rows: object[] = []
  let skippedType = 0, skippedDate = 0, noCoords = 0

  for (const project of allProjects) {
    // Convert SVY21 to WGS84 once per project
    let coords: { lat: number; lng: number } | null = null
    const ex = parseFloat(project.x ?? '')
    const ey = parseFloat(project.y ?? '')
    if (!isNaN(ex) && !isNaN(ey) && ex > 0 && ey > 0) {
      try { coords = svy21ToWgs84(ex, ey) } catch { noCoords++ }
    } else {
      noCoords++
    }

    for (const tx of project.transaction ?? []) {
      // Filter to allowed non-landed strata types
      if (!ALLOWED_TYPES.has(tx.propertyType)) { skippedType++; continue }
      if (tx.typeOfArea !== 'Strata') { skippedType++; continue }

      // Filter to months we need
      const mmyy = tx.contractDate
      if (!needSet.has(mmyy)) { skippedDate++; continue }

      const areaSqm  = parseFloat(tx.area)
      const price    = parseInt(tx.price)
      if (isNaN(areaSqm) || areaSqm <= 0 || isNaN(price) || price <= 0) continue

      const areaSqft = Math.round(areaSqm * 10.7639)
      const psf      = price / areaSqft
      if (psf < 100 || psf > 15000) continue  // sanity check

      const txDate = parseContractDate(mmyy)
      if (!txDate) continue

      rows.push({
        project_name:    project.project,
        street:          project.street,
        area_sqft:       areaSqft,
        price,
        psf:             Math.round(psf * 100) / 100,
        transaction_date: txDate,
        property_type:   tx.propertyType,
        tenure:          tx.tenure,
        floor_level:     tx.floorRange,
        lat:             coords?.lat  ?? null,
        lng:             coords?.lng  ?? null,
        geocoded:        !!coords,
        last_updated:    new Date().toISOString(),
      })
    }
  }

  console.log(`\nBuilt ${rows.length} valid rows`)
  console.log(`  Skipped (wrong type/area): ${skippedType}`)
  console.log(`  Skipped (date not needed): ${skippedDate}`)
  console.log(`  Projects without coords:   ${noCoords}`)

  if (rows.length === 0) {
    console.log('No rows to insert.')
    return
  }

  // Delete stale partial data for months we're about to fill
  for (const mmyy of needFetch) {
    if ((monthCounts[mmyy] ?? 0) === 0) continue  // nothing to clean
    const mm   = mmyy.slice(0, 2)
    const yyyy = 2000 + parseInt(mmyy.slice(2, 4))
    const nextMm   = parseInt(mm) === 12 ? '01' : String(parseInt(mm) + 1).padStart(2, '0')
    const nextYyyy = parseInt(mm) === 12 ? yyyy + 1 : yyyy
    await supabase.from('condo_transactions')
      .delete()
      .gte('transaction_date', `${yyyy}-${mm}-01`)
      .lt('transaction_date', `${nextYyyy}-${nextMm}-01`)
  }

  // Insert in batches
  let totalInserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error, count } = await supabase
      .from('condo_transactions')
      .insert(batch, { count: 'exact' })
    if (error) {
      console.error(`  Insert error (batch ${Math.floor(i/BATCH_SIZE)+1}):`, error.message)
    } else {
      totalInserted += count ?? batch.length
      process.stdout.write('.')
    }
  }
  console.log()

  // Summary
  const { count: finalCount } = await supabase
    .from('condo_transactions')
    .select('*', { count: 'exact', head: true })

  console.log(`\n✓ Inserted ${totalInserted} rows`)
  console.log(`  Total condo_transactions in DB: ${finalCount}`)

  // Per-month breakdown
  const { data: monthCheck } = await supabase
    .from('condo_transactions')
    .select('transaction_date')
  const finalCounts: Record<string, number> = {}
  for (const r of monthCheck ?? []) {
    if (!r.transaction_date) continue
    const k = isoToMmyy(r.transaction_date)
    finalCounts[k] = (finalCounts[k] ?? 0) + 1
  }
  console.log('\nFinal per-month counts:')
  for (const k of [...wantedMonths].sort()) {
    console.log(`  ${k}: ${finalCounts[k] ?? 0}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
