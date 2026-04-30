/**
 * Scrape affiliated secondary school for each primary school from MOE detail pages
 * URL pattern: https://www.moe.gov.sg/schoolfinder/schooldetail/{slug}
 *
 * Affiliation appears as:
 *   "Affiliated Secondary School: <Name>"
 * or in a table cell labeled "Affiliated Secondary School"
 */
import { chromium, type Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const SUPABASE_URL = 'https://jekmiqmjqebyzoidfgry.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_3iba6WVpWBm6bjwBnOAPHg_GPcC_L-r'

const RESULTS_FILE = '/tmp/affiliations.json'

interface SchoolAffiliation {
  id: number
  name: string
  slug: string
  affiliated_secondary: string | null
  error?: string
}

// Attempt to extract affiliation from an already-loaded detail page
async function extractAffiliation(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const body = document.body.innerText

    // Pattern: "Affiliations\n<school name>" — exactly as it appears on MOE detail pages
    // The tab character separates the label from value on the same visual row
    const m1 = body.match(/Affiliations[\t\s]*\n([^\n]+)/)
    if (m1) {
      const val = m1[1].trim()
      if (val && val.toLowerCase() !== 'nil' && val !== '-' && val !== 'None') return val
    }

    // Pattern 2: "Affiliated Secondary School" label (older page format)
    const m2 = body.match(/Affiliated Secondary School[\t:\s]*\n?([^\n]+)/i)
    if (m2) {
      const val = m2[1].trim()
      if (val && val.toLowerCase() !== 'nil' && val !== '-') return val
    }

    // Pattern 3: Look in DOM for the Affiliations section
    const allEls = document.querySelectorAll('*')
    for (const el of Array.from(allEls)) {
      const text = el.textContent?.trim() || ''
      if (text === 'Affiliations') {
        // Check next sibling
        let next = el.nextElementSibling
        while (next) {
          const val = next.textContent?.trim()
          if (val && val.toLowerCase() !== 'nil' && val !== '-' && val.length > 2) return val
          next = next.nextElementSibling
        }
        // Check parent's next sibling
        const parentNext = el.parentElement?.nextElementSibling
        if (parentNext) {
          const val = parentNext.textContent?.trim()
          if (val && val.toLowerCase() !== 'nil' && val !== '-' && val.length > 2) return val
        }
      }
    }

    return null
  })
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Load slugs
  const slugsRaw: { name: string; slug: string }[] = JSON.parse(
    fs.readFileSync(
      '/Users/brandonlim/Documents/Claude Code/PR School Finder/schoolmap-sg/scripts/moe_school_slugs.json',
      'utf8'
    )
  )

  // Load any existing results to resume
  let existing: Map<string, SchoolAffiliation> = new Map()
  if (fs.existsSync(RESULTS_FILE)) {
    const prev: SchoolAffiliation[] = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'))
    existing = new Map(prev.map(s => [s.slug, s]))
    console.log(`Resuming: ${existing.size} schools already processed`)
  }

  // Fetch DB ids
  const { data: dbSchools, error } = await supabase.from('schools').select('id, name')
  if (error || !dbSchools) { console.error(error); process.exit(1) }
  // Case-insensitive map: uppercase → id
  const dbMap = new Map(dbSchools.map(s => [s.name.toUpperCase(), s.id]))

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 900 })

  const results: SchoolAffiliation[] = []
  const toProcess = slugsRaw.filter(s => !existing.has(s.slug))
  console.log(`Processing ${toProcess.length} schools...`)

  for (let i = 0; i < toProcess.length; i++) {
    const { name, slug } = toProcess[i]
    const dbId = dbMap.get(name.toUpperCase()) ?? null
    process.stdout.write(`[${i + 1}/${toProcess.length}] ${name}... `)

    try {
      const url = `https://www.moe.gov.sg/schoolfinder/schooldetail/${slug}`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(1500)

      const affiliation = await extractAffiliation(page)
      console.log(affiliation ? `→ ${affiliation}` : '→ none')

      const entry: SchoolAffiliation = {
        id: dbId,
        name,
        slug,
        affiliated_secondary: affiliation,
      }
      results.push(entry)
    } catch (err) {
      console.log(`→ ERROR: ${err}`)
      results.push({ id: dbId, name, slug, affiliated_secondary: null, error: String(err) })
    }

    // Save progress every 10 schools
    if ((i + 1) % 10 === 0) {
      const all = [...Array.from(existing.values()), ...results]
      fs.writeFileSync(RESULTS_FILE, JSON.stringify(all, null, 2))
    }
  }

  // Final save
  const all = [...Array.from(existing.values()), ...results]
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(all, null, 2))

  await browser.close()

  // Show schools with affiliations
  const withAff = all.filter(s => s.affiliated_secondary)
  console.log(`\n=== Schools with affiliations (${withAff.length}) ===`)
  for (const s of withAff) {
    console.log(`  ${s.name} → ${s.affiliated_secondary}`)
  }

  // Update DB
  console.log('\nUpdating DB...')
  let updated = 0
  for (const s of withAff) {
    if (!s.id) { console.log(`  SKIP (no DB id): ${s.name}`); continue }
    const { error: upErr } = await supabase
      .from('schools')
      .update({ affiliated_secondary: s.affiliated_secondary })
      .eq('id', s.id)
    if (upErr) console.error(`  Error updating ${s.name}:`, upErr)
    else updated++
  }
  console.log(`Updated ${updated} schools in DB`)
}

main().catch(console.error)
