/**
 * Set affiliated_sec_tier for each school based on the affiliated secondary name
 * Tiers: 'top10' = IP school or very competitive, 'good' = established/autonomous, null = other/none
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jekmiqmjqebyzoidfgry.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_3iba6WVpWBm6bjwBnOAPHg_GPcC_L-r'
)

// Map secondary school name → tier
// 'top10' = IP school + most competitive secondaries
// 'good'  = autonomous/established affiliated secondary
const SECONDARY_TIER: Record<string, 'top10' | 'good'> = {
  // True top-10 IP secondary schools (offer Integrated Programme — no O-levels)
  'Anglo-Chinese School (Independent) (Junior College)': 'top10', // ACS(I) is IP
  'Anglo-Chinese School (Independent) (Secondary)':     'top10',
  "Methodist Girls' School (Secondary)":               'top10', // MGS is IP
  "Nanyang Girls' High School":                        'top10', // NYGH is IP
  "Singapore Chinese Girls' School":                   'top10', // SCGS is IP
  // Strong autonomous affiliated schools (good but not IP)
  "CHIJ Katong Convent":                               'good',
  "CHIJ Secondary (Toa Payoh)":                        'good',
  "CHIJ St. Joseph's Convent":                         'good',
  "CHIJ St. Theresa's Convent":                        'good',
  "Catholic Junior College":                           'good',  // JC affiliation, not IP pipeline
  "Fairfield Methodist School (Secondary)":            'good',
  "Geylang Methodist School (Secondary)":              'good',
  "Holy Innocents' High School":                       'good',
  "Kuo Chuan Presbyterian Secondary School":           'good',
  "Manjusri Secondary School":                         'good',
  "Montfort Secondary School":                         'good',
  "Ngee Ann Secondary School":                         'good',
  "Paya Lebar Methodist Girls' School (Secondary)":    'good',
  "St Andrew's School (Secondary)":                    'good',
  "St. Anthony's Canossian Secondary School":          'good',
  "St. Gabriel's Secondary School":                    'good',
  "St. Hilda's Secondary School":                      'good',
  "St. Joseph's Institution (Junior College)":         'good',  // SJI is autonomous but not IP
  "St. Joseph's Institution (Secondary)":              'good',
  "St. Margaret's School (Secondary)":                 'good',
  "St. Stephen's School":                              'good',  // secondary
}

async function main() {
  const { data: schools, error } = await supabase
    .from('schools')
    .select('id, name, affiliated_secondary')
    .not('affiliated_secondary', 'is', null)

  if (error || !schools) { console.error(error); process.exit(1) }
  console.log(`Schools with affiliation: ${schools.length}`)

  let updated = 0
  for (const s of schools) {
    const tier = SECONDARY_TIER[s.affiliated_secondary] ?? null

    const { error: upErr } = await supabase
      .from('schools')
      .update({ affiliated_sec_tier: tier })
      .eq('id', s.id)

    if (upErr) {
      console.error(`Error updating ${s.name}:`, upErr)
    } else {
      console.log(`  ${s.name} → ${s.affiliated_secondary} → tier: ${tier ?? 'null'}`)
      updated++
    }
  }

  console.log(`\nUpdated ${updated} schools with tier`)
}

main().catch(console.error)
