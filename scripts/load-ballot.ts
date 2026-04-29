/**
 * load-ballot.ts
 * Reads scripts/schools_ballot_raw.json and upserts into school_ballot_data table.
 * Matches school names from JSON to school IDs in the schools table (fuzzy on name).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/load-ballot.ts
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const INPUT_PATH = path.resolve('scripts/schools_ballot_raw.json')

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Missing env vars. Run: npx tsx --env-file=.env.local scripts/load-ballot.ts')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  const raw = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'))
  console.log(`Loaded ${raw.length} ballot records from JSON`)

  // Fetch all schools to build name → id map
  const { data: schools, error: schoolErr } = await supabase
    .from('schools')
    .select('id, name')

  if (schoolErr || !schools) {
    console.error('Failed to fetch schools:', schoolErr?.message)
    process.exit(1)
  }

  // Explicit overrides for sgschooling short names → exact DB names
  // Schools marked null are mixed-level (not primary-only) and correctly absent from DB
  const EXPLICIT_MAP: Record<string, string | null> = {
    'Anglo-Chinese (Junior)':          'ANGLO-CHINESE SCHOOL (JUNIOR)',
    'Anglo-Chinese (Primary)':         'ANGLO-CHINESE SCHOOL (PRIMARY)',
    'Catholic High':                   null,  // mixed-level P1-S4, not in DB
    'CHIJ (Toa Payoh)':                'CHIJ PRIMARY (TOA PAYOH)',
    'CHIJ St. Nicholas Girls\'':       null,  // mixed-level, not in DB
    'Haig Girls\'':                    'HAIG GIRLS\' SCHOOL',
    'Holy Innocents\'':                'HOLY INNOCENTS\' PRIMARY SCHOOL',
    'Maris Stella High':               null,  // mixed-level, not in DB
    'Methodist Girls\'':               'METHODIST GIRLS\' SCHOOL (PRIMARY)',
    'Paya Lebar Methodist Girls\'':    'PAYA LEBAR METHODIST GIRLS\' SCHOOL (PRIMARY)',
    'Raffles Girls\'':                 'RAFFLES GIRLS\' PRIMARY SCHOOL',
    'Singapore Chinese Girls\'':       'SINGAPORE CHINESE GIRLS\' PRIMARY SCHOOL',
    'St. Andrew\'s Junior':            'ST ANDREW\'S SCHOOL (JUNIOR)',
    'St. Anthony\'s Canossian':        'ST. ANTHONY\'S CANOSSIAN PRIMARY SCHOOL',
    'St. Anthony\'s':                  'ST. ANTHONY\'S PRIMARY SCHOOL',
    'St. Gabriel\'s':                  'ST. GABRIEL\'S PRIMARY SCHOOL',
    'St. Hilda\'s':                    'ST. HILDA\'S PRIMARY SCHOOL',
    'St. Joseph\'s Institution Junior':'ST. JOSEPH\'S INSTITUTION JUNIOR',
    'St. Margaret\'s':                 'ST. MARGARET\'S SCHOOL (PRIMARY)',
    'St. Stephen\'s':                  'ST. STEPHEN\'S SCHOOL',
  }

  // Build lookup: normalised name → id
  const nameToId = new Map<string, string>()
  for (const s of schools) {
    nameToId.set(s.name.toLowerCase(), s.id)
  }

  // Normalise curly/right apostrophes → straight for consistent map lookup
  function normaliseApostrophe(s: string) {
    return s.replace(/[‘’‚′]/g, "'")
  }

  function resolveSchoolId(rawName: string): string | null {
    const scrapedName = normaliseApostrophe(rawName)
    // Check explicit map first
    if (scrapedName in EXPLICIT_MAP) {
      const mapped = EXPLICIT_MAP[scrapedName]
      if (mapped === null) return null  // intentionally excluded
      return nameToId.get(mapped.toLowerCase()) ?? null
    }

    const lower = normaliseApostrophe(scrapedName).toLowerCase()
    // Exact: "admiralty primary school"
    if (nameToId.has(lower + ' primary school')) return nameToId.get(lower + ' primary school')!
    if (nameToId.has(lower)) return nameToId.get(lower)!
    // Starts-with
    for (const [name, id] of nameToId) {
      if (name.startsWith(lower)) return id
    }
    // Contains
    for (const [name, id] of nameToId) {
      if (name.includes(lower)) return id
    }
    return null
  }

  const unmatched: string[] = []
  const records = []

  for (const row of raw) {
    const schoolId = resolveSchoolId(row.school_name)
    if (!schoolId) {
      if (!unmatched.includes(row.school_name)) unmatched.push(row.school_name)
      continue
    }

    // Compute derived fields
    const vacancyPct = (row.phase2c_vacancies != null && row.total_p1_intake)
      ? parseFloat(((row.phase2c_vacancies / row.total_p1_intake) * 100).toFixed(2))
      : null

    const applicantVacancyRatio = (row.phase2c_applicants != null && row.phase2c_vacancies)
      ? parseFloat((row.phase2c_applicants / row.phase2c_vacancies).toFixed(2))
      : null

    records.push({
      school_id: schoolId,
      year: row.year,
      total_p1_intake: row.total_p1_intake,
      phase2c_vacancies: row.phase2c_vacancies,
      phase2c_applicants: row.phase2c_applicants,
      ballot_held: row.ballot_held,
      ballot_type: row.ballot_type,
      supplementary_triggered: row.supplementary_triggered,
      vacancy_pct: vacancyPct,
      applicant_vacancy_ratio: applicantVacancyRatio,
      data_source: 'sgschooling',
      verified: false,
    })
  }

  if (unmatched.length > 0) {
    console.warn(`\n⚠️  ${unmatched.length} school names not matched to schools table:`)
    for (const name of unmatched) console.warn(`   - "${name}"`)
    console.warn('These records will be skipped. Add manual mappings in resolveSchoolId() if needed.')
  }

  console.log(`\nInserting ${records.length} ballot records...`)

  // Upsert in batches
  const BATCH = 50
  let inserted = 0
  let errors = 0

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const { error } = await supabase
      .from('school_ballot_data')
      .upsert(batch, { onConflict: 'school_id,year' })

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message)
      errors++
    } else {
      inserted += batch.length
    }
  }

  console.log(`\n✅ Inserted ${inserted} records, ${errors} batch errors`)
  console.log(`   Skipped ${raw.length - records.length} (unmatched school names)`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
