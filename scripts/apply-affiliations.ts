/**
 * Apply already-scraped affiliations from /tmp/affiliations.json to Supabase DB
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const supabase = createClient(
  'https://jekmiqmjqebyzoidfgry.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_3iba6WVpWBm6bjwBnOAPHg_GPcC_L-r'
)

async function main() {
  const scraped: Array<{ name: string; slug: string; affiliated_secondary: string | null }> =
    JSON.parse(fs.readFileSync('/tmp/affiliations.json', 'utf8'))

  // Load DB schools (uppercase names)
  const { data: dbSchools, error } = await supabase.from('schools').select('id, name')
  if (error || !dbSchools) { console.error(error); process.exit(1) }
  const dbMap = new Map(dbSchools.map(s => [s.name.toUpperCase(), s.id]))

  const withAff = scraped.filter(s => s.affiliated_secondary)
  console.log(`Schools with affiliations: ${withAff.length}`)

  let updated = 0
  for (const s of withAff) {
    const id = dbMap.get(s.name.toUpperCase())
    if (!id) {
      console.log(`  NOT FOUND in DB: "${s.name}"`)
      continue
    }
    const { error: upErr } = await supabase
      .from('schools')
      .update({ affiliated_secondary: s.affiliated_secondary })
      .eq('id', id)
    if (upErr) {
      console.error(`  Error updating "${s.name}":`, upErr)
    } else {
      console.log(`  ✓ ${s.name} → ${s.affiliated_secondary}`)
      updated++
    }
  }
  console.log(`\nUpdated ${updated} schools`)
}

main().catch(console.error)
