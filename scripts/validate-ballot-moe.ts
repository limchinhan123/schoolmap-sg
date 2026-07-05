/**
 * Cross-validate school_ballot_data (Phase 2C) against sgschooling.com
 * sgschooling.com cites and faithfully reproduces MOE's official P1 registration data.
 *
 * Outputs: scripts/discrepancies.csv
 * Does NOT touch the database.
 */

import { chromium, Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ── Supabase ───────────────────────────────────────────────────────────────────

const supabase = createClient(
  'https://jekmiqmjqebyzoidfgry.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_3iba6WVpWBm6bjwBnOAPHg_GPcC_L-r'
)

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScrapedRow {
  school_short: string   // sgschooling abbreviated name e.g. "Admiralty"
  year: number
  ballot_type: string    // e.g. "SC<1", "no_ballot", "PR<1", "PR<1#" etc.
  ballot_held: boolean
  supplementary_triggered: boolean
  phase2c_vacancies: number | null
  phase2c_applicants: number | null
}

interface DbRow {
  name: string           // full uppercase DB name
  year: number
  ballot_type: string
  ballot_held: boolean
  supplementary_triggered: boolean
  phase2c_vacancies: number | null
  phase2c_applicants: number | null
}

// ── Name normalisation ─────────────────────────────────────────────────────────
// sgschooling uses shortened names; DB uses full uppercase MOE names.
// Build a lookup: normalised_short → db_name by stripping common suffixes.

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/primary school$/i, '')
    .replace(/\(primary\)$/i, '')
    .replace(/ school$/i, '')
    .replace(/\(junior\)$/i, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Scrape one year page ───────────────────────────────────────────────────────

async function scrapeYear(page: Page, year: number): Promise<ScrapedRow[]> {
  console.log(`  Scraping ${year}...`)
  await page.goto(`https://www.sgschooling.com/year/${year}/all`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await page.waitForTimeout(2000)

  // Pass year as a JSON arg to avoid esbuild touching the evaluate body
  const rows = await page.evaluate(`
    (function(yr) {
      var result = [];
      var tableRows = Array.from(document.querySelectorAll('table tbody tr'));

      var currentSchool = '';
      var vacancyRow = [];
      var appliedRow = [];
      var takenCells = [];

      function getBallotType(cell) {
        var span = cell.querySelector('.tt[data-tt-title]');
        if (!span) return null;
        return span.getAttribute('data-tt-title');
      }

      function getApplicantsVacancies(cell) {
        var span = cell.querySelector('.tt');
        if (!span) return null;
        var text = span.textContent || '';
        var m = text.match(/(\\d+)\\/(\\d+)/);
        if (!m) return null;
        return { app: parseInt(m[1]), vac: parseInt(m[2]) };
      }

      function parseNum(s) {
        var n = parseInt(s.replace(/[^0-9]/g, ''));
        return isNaN(n) ? null : n;
      }

      for (var i = 0; i < tableRows.length; i++) {
        var tr = tableRows[i];
        var cells = Array.from(tr.querySelectorAll('td'));
        if (cells.length === 0) continue;

        var firstCell = (cells[0].textContent || '').trim();

        if (firstCell.indexOf('\\u21b3 Vacancy') !== -1 || firstCell.indexOf('Vacancy') !== -1) {
          vacancyRow = cells.slice(1).map(function(c) { return (c.textContent || '').trim(); });
        } else if (firstCell.indexOf('Applied') !== -1) {
          appliedRow = cells.slice(1).map(function(c) { return (c.textContent || '').trim(); });
        } else if (firstCell.indexOf('Taken') !== -1) {
          takenCells = cells.slice(1);

          if (currentSchool) {
            var col2C  = takenCells[3] || null;
            var col2CS = takenCells[4] || null;

            var bt2C  = col2C  ? getBallotType(col2C)  : null;
            var bt2CS = col2CS ? getBallotType(col2CS) : null;

            var ballotType = bt2C !== null ? bt2C : (bt2CS !== null ? bt2CS : 'no_ballot');
            var ballotHeld = bt2C !== null || bt2CS !== null;

            var vac2CS = parseNum(vacancyRow[4] || '');
            var app2CS = parseNum(appliedRow[4] || '');
            var suppTriggered = (vac2CS !== null && vac2CS > 0) && (app2CS !== null && app2CS > 0);

            var vac2C = parseNum(vacancyRow[3] || '');
            var app2C = parseNum(appliedRow[3] || '');

            var avFromSpan = col2C ? getApplicantsVacancies(col2C) : null;
            var finalApp = avFromSpan ? avFromSpan.app : app2C;
            var finalVac = avFromSpan ? avFromSpan.vac : vac2C;

            result.push({
              school_short: currentSchool,
              year: yr,
              ballot_type: ballotType,
              ballot_held: ballotHeld,
              supplementary_triggered: suppTriggered,
              phase2c_vacancies: finalVac,
              phase2c_applicants: finalApp,
            });
          }
        } else {
          var strong = tr.querySelector('strong, a');
          if (strong) {
            currentSchool = (strong.textContent || '').trim();
            vacancyRow = [];
            appliedRow = [];
          }
        }
      }

      return result;
    })(${year})
  `) as Array<{
    school_short: string
    year: number
    ballot_type: string
    ballot_held: boolean
    supplementary_triggered: boolean
    phase2c_vacancies: number | null
    phase2c_applicants: number | null
  }>

  console.log(`    → ${rows.length} schools scraped`)
  return rows
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Fetch DB data
  console.log('Fetching DB ballot data...')
  const { data: dbData, error } = await supabase
    .from('school_ballot_data')
    .select(`
      year, ballot_type, ballot_held, supplementary_triggered,
      phase2c_vacancies, phase2c_applicants,
      schools ( name )
    `)
    .in('year', [2022, 2023, 2024])
    .order('year')

  if (error || !dbData) { console.error('DB error:', error); process.exit(1) }
  console.log(`Loaded ${dbData.length} DB rows`)

  // Build DB lookup: normalised_name+year → DbRow
  const dbMap = new Map<string, DbRow>()
  for (const row of dbData as any[]) {
    const name = row.schools?.name ?? ''
    const key = `${normalise(name)}|${row.year}`
    dbMap.set(key, {
      name,
      year: row.year,
      ballot_type: row.ballot_type,
      ballot_held: row.ballot_held,
      supplementary_triggered: row.supplementary_triggered,
      phase2c_vacancies: row.phase2c_vacancies,
      phase2c_applicants: row.phase2c_applicants,
    })
  }

  // 2. Scrape sgschooling.com
  console.log('\nLaunching Playwright...')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const scraped: ScrapedRow[] = []
  for (const year of [2022, 2023, 2024]) {
    const rows = await scrapeYear(page, year)
    scraped.push(...rows)
  }
  await browser.close()
  console.log(`\nTotal scraped: ${scraped.length} rows`)

  // 3. Build scraped lookup: normalised_short+year → ScrapedRow
  const scrapedMap = new Map<string, ScrapedRow>()
  for (const row of scraped) {
    const key = `${normalise(row.school_short)}|${row.year}`
    scrapedMap.set(key, row)
  }

  // 4. Cross-reference: match scraped to DB
  // Build a fuzzy match table: for each DB name, find best scraped key
  const dbNames = [...new Set([...dbMap.keys()].map(k => k.split('|')[0]))]

  // For each scraped short name, find DB match
  function findDbMatch(shortNorm: string): string | null {
    // Exact match
    if (dbNames.includes(shortNorm)) return shortNorm
    // Contains match
    for (const dn of dbNames) {
      if (dn.includes(shortNorm) || shortNorm.includes(dn)) return dn
    }
    // Partial first-word match
    const firstWord = shortNorm.split(' ')[0]
    const matches = dbNames.filter(dn => dn.startsWith(firstWord))
    if (matches.length === 1) return matches[0]
    return null
  }

  // 5. Compare
  const discrepancies: string[] = []
  const csvHeader = 'year,sgschooling_name,db_name,field,sgschooling_value,db_value'
  discrepancies.push(csvHeader)

  let totalCompared = 0
  let totalMatched = 0
  let totalDiscrepancies = 0
  let noMatchCount = 0

  for (const [key, scraped_row] of scrapedMap.entries()) {
    const [shortNorm, yearStr] = key.split('|')
    const year = parseInt(yearStr)
    const dbNorm = findDbMatch(shortNorm)

    if (!dbNorm) {
      noMatchCount++
      continue
    }

    const dbKey = `${dbNorm}|${year}`
    const db_row = dbMap.get(dbKey)
    if (!db_row) continue

    totalCompared++

    // Compare ballot_type
    if (scraped_row.ballot_type !== db_row.ballot_type) {
      totalDiscrepancies++
      discrepancies.push(
        `${year},"${scraped_row.school_short}","${db_row.name}",ballot_type,"${scraped_row.ballot_type}","${db_row.ballot_type}"`
      )
    }

    // Compare ballot_held
    if (scraped_row.ballot_held !== db_row.ballot_held) {
      totalDiscrepancies++
      discrepancies.push(
        `${year},"${scraped_row.school_short}","${db_row.name}",ballot_held,"${scraped_row.ballot_held}","${db_row.ballot_held}"`
      )
    }

    // Compare supplementary_triggered
    if (scraped_row.supplementary_triggered !== db_row.supplementary_triggered) {
      totalDiscrepancies++
      discrepancies.push(
        `${year},"${scraped_row.school_short}","${db_row.name}",supplementary_triggered,"${scraped_row.supplementary_triggered}","${db_row.supplementary_triggered}"`
      )
    }

    if (scraped_row.ballot_type === db_row.ballot_type &&
        scraped_row.ballot_held === db_row.ballot_held &&
        scraped_row.supplementary_triggered === db_row.supplementary_triggered) {
      totalMatched++
    }
  }

  // Write CSV
  const csvPath = path.join(process.cwd(), 'scripts', 'discrepancies.csv')
  fs.writeFileSync(csvPath, discrepancies.join('\n'))

  // 6. Summary
  console.log('\n══════════════════════════════════════')
  console.log('CROSS-VALIDATION REPORT')
  console.log('══════════════════════════════════════')
  console.log(`Schools compared:   ${totalCompared}`)
  console.log(`Schools matched:    ${totalMatched} (${Math.round(100 * totalMatched / totalCompared)}%)`)
  console.log(`No match (name):    ${noMatchCount}`)
  console.log(`Discrepancies:      ${totalDiscrepancies}`)
  console.log(`Output:             ${csvPath}`)
  console.log('══════════════════════════════════════')

  if (totalDiscrepancies > 0) {
    console.log('\nDiscrepant rows:')
    discrepancies.slice(1).forEach(l => console.log(' ', l))
  } else {
    console.log('\n✓ All compared rows match exactly.')
  }
}

main().catch(console.error)
