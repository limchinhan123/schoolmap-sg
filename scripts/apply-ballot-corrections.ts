/**
 * Applies all corrections from scripts/discrepancies.csv to school_ballot_data.
 * Groups by (db_name, year), builds a single update per row.
 * Does NOT touch the schools table.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabase = createClient(
  'https://jekmiqmjqebyzoidfgry.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_3iba6WVpWBm6bjwBnOAPHg_GPcC_L-r'
)

// ── Parse CSV ─────────────────────────────────────────────────────────────────

interface Correction {
  year: number
  db_name: string
  ballot_type?: string
  ballot_held?: boolean
  supplementary_triggered?: boolean
}

function parseCSV(): Map<string, Correction> {
  const raw = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'discrepancies.csv'), 'utf8'
  )
  const map = new Map<string, Correction>() // key = "db_name|year"

  for (const line of raw.trim().split('\n').slice(1)) {
    const m = line.match(/^(\d+),"[^"]*","([^"]+)",(\w+),"([^"]+)","([^"]*)"$/)
    if (!m) { console.warn('Skipping unparseable line:', line); continue }

    const year    = parseInt(m[1])
    const db_name = m[2]
    const field   = m[3]
    const sgVal   = m[4]
    const key     = `${db_name}|${year}`

    if (!map.has(key)) map.set(key, { year, db_name })
    const rec = map.get(key)!

    if (field === 'ballot_type')            rec.ballot_type   = sgVal
    if (field === 'ballot_held')            rec.ballot_held   = sgVal === 'true'
    if (field === 'supplementary_triggered') rec.supplementary_triggered = sgVal === 'true'
  }

  return map
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const corrections = parseCSV()
  console.log(`Parsed ${corrections.size} school/year corrections from discrepancies.csv\n`)

  // Fetch school name → id mapping for all affected names
  const affectedNames = [...new Set([...corrections.values()].map(c => c.db_name))]
  const { data: schools, error: sErr } = await supabase
    .from('schools')
    .select('id, name')
    .in('name', affectedNames)

  if (sErr || !schools) { console.error('DB error:', sErr); process.exit(1) }

  const nameToId = new Map(schools.map(s => [s.name, s.id]))
  const missing = affectedNames.filter(n => !nameToId.has(n))
  if (missing.length) console.warn('Schools not found in DB:', missing)

  // Apply each correction
  let ok = 0, fail = 0
  for (const [key, corr] of corrections.entries()) {
    const schoolId = nameToId.get(corr.db_name)
    if (!schoolId) { fail++; continue }

    const update: Record<string, unknown> = {}
    if (corr.ballot_type   !== undefined) update.ballot_type   = corr.ballot_type
    if (corr.ballot_held   !== undefined) update.ballot_held   = corr.ballot_held
    if (corr.supplementary_triggered !== undefined) update.supplementary_triggered = corr.supplementary_triggered

    const { error } = await supabase
      .from('school_ballot_data')
      .update(update)
      .eq('school_id', schoolId)
      .eq('year', corr.year)

    if (error) {
      console.error(`  ✗ ${corr.db_name} ${corr.year}: ${error.message}`)
      fail++
    } else {
      console.log(`  ✓ ${corr.db_name} ${corr.year} → ${JSON.stringify(update)}`)
      ok++
    }
  }

  console.log(`\n✅ Applied: ${ok}  ✗ Failed: ${fail}`)
}

main().catch(console.error)
