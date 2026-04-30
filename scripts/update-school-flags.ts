/**
 * Update school flags from MOE-extracted data:
 *   is_autonomous, is_sap, is_gep_centre, is_ip_pipeline
 *
 * Uses the service role key for writes (or publishable key for reads to verify).
 * Run: npx tsx scripts/update-school-flags.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

// Read Supabase URL / key from env
const SUPABASE_URL = 'https://jekmiqmjqebyzoidfgry.supabase.co'
// Use the publishable key for now — RLS must allow updates, or add service key
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_3iba6WVpWBm6bjwBnOAPHg_GPcC_L-r'

// Manual name mapping: MOE name → DB name (for mismatches)
const NAME_MAP: Record<string, string> = {
  'Canossa Catholic Primary': 'CANOSSA CATHOLIC PRIMARY SCHOOL',
  'Nanyang Primary': 'NANYANG PRIMARY SCHOOL',      // duplicate entry; use union of flags below
  'Ngee Ann Primary': 'NGEE ANN PRIMARY SCHOOL',
  'Singapore Chinese Girls (Primary)': "SINGAPORE CHINESE GIRLS' PRIMARY SCHOOL",
  "St Anthony's Canossian Primary": "ST. ANTHONY'S CANOSSIAN PRIMARY SCHOOL",
  "St Anthony's Primary": "ST. ANTHONY'S PRIMARY SCHOOL",
  "St Margaret's School (Primary)": "ST. MARGARET'S SCHOOL (PRIMARY)",
  "St Stephen's Primary": "ST. STEPHEN'S SCHOOL",
}

// Schools in MOE data that are NOT in our DB (closed / merged / missing)
const SKIP_SCHOOLS = new Set([
  // Schools on secondary campuses — not in our primary DB
  'Catholic High School (Primary)',
  "CHIJ St. Nicholas Girls' School (Primary)",
  'Maris Stella High School (Primary)',
  // Canonical uppercase forms
  'CATHOLIC HIGH SCHOOL (PRIMARY)',
  "CHIJ ST. NICHOLAS GIRLS' SCHOOL (PRIMARY)",
  'MARIS STELLA HIGH SCHOOL (PRIMARY)',
  // Abbreviated duplicates in MOE scrape (all-N flags — safe to skip)
  "CHIJ ST NICHOLAS GIRLS' (PRIMARY)",
  'MARIS STELLA HIGH (PRIMARY)',
  "HOLY INNOCENTS' PRIMARY",          // long form "...PRIMARY SCHOOL" is found correctly
  'KUO CHUAN PRESBYTERIAN PRIMARY',   // long form "...PRIMARY SCHOOL" is found correctly
  "ST GABRIEL'S PRIMARY",
  "ST HILDA'S PRIMARY",
])

interface MoeSchool {
  name: string
  slug: string
  autonomous: 'Y' | 'N'
  sap: 'Y' | 'N'
  ip: 'Y' | 'N'
  gifted: 'Y' | 'N'
  alp: string | null
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Load MOE flag data
  const moeRaw: MoeSchool[] = JSON.parse(fs.readFileSync('/tmp/moe_school_flags.json', 'utf8'))

  // Deduplicate by canonical name, taking union of flags
  const moeMap = new Map<string, MoeSchool>()
  for (const s of moeRaw) {
    const canonical = NAME_MAP[s.name] || s.name.toUpperCase()
    const existing = moeMap.get(canonical)
    if (!existing) {
      moeMap.set(canonical, { ...s, name: canonical })
    } else {
      // Union: if either entry says Y, use Y
      if (s.autonomous === 'Y') existing.autonomous = 'Y'
      if (s.sap === 'Y') existing.sap = 'Y'
      if (s.ip === 'Y') existing.ip = 'Y'
      if (s.gifted === 'Y') existing.gifted = 'Y'
    }
  }

  // Fetch all schools from DB
  const { data: schools, error } = await supabase.from('schools').select('id, name')
  if (error || !schools) { console.error('DB fetch error:', error); process.exit(1) }

  const dbMap = new Map(schools.map(s => [s.name, s.id]))
  console.log(`DB has ${schools.length} schools`)

  // Build update set
  const updates: { id: number; is_autonomous: boolean; is_sap: boolean; is_gep_centre: boolean; is_ip_pipeline: boolean }[] = []
  let skipped = 0
  let notFound = 0

  for (const [canonicalName, moe] of moeMap) {
    if (SKIP_SCHOOLS.has(moe.name) || SKIP_SCHOOLS.has(canonicalName)) {
      console.log(`SKIP: ${canonicalName}`)
      skipped++
      continue
    }

    const id = dbMap.get(canonicalName)
    if (!id) {
      console.log(`NOT FOUND: "${canonicalName}"`)
      notFound++
      continue
    }

    const isAutonomous = moe.autonomous === 'Y'
    const isSap = moe.sap === 'Y'
    const isGep = moe.gifted === 'Y'
    const isIp = moe.ip === 'Y'

    if (isAutonomous || isSap || isGep || isIp) {
      updates.push({ id, is_autonomous: isAutonomous, is_sap: isSap, is_gep_centre: isGep, is_ip_pipeline: isIp })
    }
  }

  console.log(`\nPlanning to update ${updates.length} schools with Y flags`)
  console.log('Updates:')
  for (const u of updates) {
    const name = schools.find(s => s.id === u.id)?.name
    console.log(`  ${name}: auto=${u.is_autonomous} sap=${u.is_sap} gep=${u.is_gep_centre} ip=${u.is_ip_pipeline}`)
  }

  if (updates.length === 0) {
    console.log('No updates needed.')
    return
  }

  // First, reset all schools to false (so we don't have stale Y flags)
  console.log('\nResetting all schools flags to false...')
  const { error: resetErr } = await supabase.from('schools').update({
    is_autonomous: false, is_sap: false, is_gep_centre: false, is_ip_pipeline: false,
  }).not('id', 'is', null)
  if (resetErr) { console.error('Reset error:', resetErr); process.exit(1) }
  console.log('Reset done.')

  // Apply updates for schools with Y flags
  console.log('\nApplying flag updates...')
  let successCount = 0
  for (const u of updates) {
    const { error: updateErr } = await supabase.from('schools').update({
      is_autonomous: u.is_autonomous,
      is_sap: u.is_sap,
      is_gep_centre: u.is_gep_centre,
      is_ip_pipeline: u.is_ip_pipeline,
    }).eq('id', u.id)

    if (updateErr) {
      console.error(`  Error updating id=${u.id}:`, updateErr)
    } else {
      successCount++
    }
  }

  console.log(`\n✓ Updated ${successCount}/${updates.length} schools`)
  console.log(`  Skipped (not in DB): ${skipped}`)
  console.log(`  Not found: ${notFound}`)

  // Verify final counts
  const { data: final } = await supabase.from('schools').select('is_autonomous, is_sap, is_gep_centre, is_ip_pipeline')
  const finalAuto = final?.filter(s => s.is_autonomous).length ?? 0
  const finalSap = final?.filter(s => s.is_sap).length ?? 0
  const finalGep = final?.filter(s => s.is_gep_centre).length ?? 0
  const finalIp = final?.filter(s => s.is_ip_pipeline).length ?? 0
  console.log(`\nFinal DB counts: autonomous=${finalAuto} sap=${finalSap} gep=${finalGep} ip=${finalIp}`)
}

main().catch(console.error)
