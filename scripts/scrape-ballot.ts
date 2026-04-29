/**
 * scrape-ballot.ts
 * Scrapes sgschooling.com for Phase 2C ballot data for all primary schools,
 * years 2022–2024. Outputs to scripts/schools_ballot_raw.json.
 *
 * Table structure on sgschooling.com (confirmed via diagnostic):
 *   Columns: School | Phase 1 | 2A | 2B | 2C | 2C(S) | 3
 *   Each school = 4 consecutive rows:
 *     Row 1: ["SchoolName", " ", " ", ...]          ← school header
 *     Row 2: ["↳ Vacancy (N)", "150", "68", "31", "69",  "0", "0"]  ← col[0] has total intake N
 *     Row 3: ["↳ Applied",    "82",  "34", "25", "134", "0", "-"]   ← col[4] = 2C applicants
 *     Row 4: ["↳ Taken",      "82",  "34", "25", "69SC<1109/69", "0", "-"]  ← col[4] has ballot type
 *
 *   Phase 2C column index = 4
 *   Phase 2C(S) column index = 5
 *
 * Ballot type is embedded in the Taken row's 2C cell, e.g.:
 *   "69SC<1109/69"  → ballot_type = "SC<1"
 *   "60PR<15/3"     → ballot_type = "PR<1"
 *   "69"            → no ballot (all taken), ballot_held = false
 *   "-"             → no applicants in this phase
 *
 * Usage:
 *   npx tsx scripts/scrape-ballot.ts
 *
 * Prerequisites:
 *   npm install -D playwright && npx playwright install chromium
 */

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const YEARS = [2024, 2023, 2022]
const BASE_URL = 'https://sgschooling.com/year'
const OUTPUT_PATH = path.resolve('scripts/schools_ballot_raw.json')

// Column indices in the table
const COL_2C   = 4
const COL_2CS  = 5

type BallotType = 'SC<1' | 'SC1-2' | 'SC>2' | 'PR<1' | 'PR1-2' | 'PR>2' | 'SC<2#' | 'PR<2#' | 'SC#' | 'no_ballot' | null

interface BallotRecord {
  school_name: string
  year: number
  total_p1_intake: number | null
  phase2c_vacancies: number | null
  phase2c_applicants: number | null
  ballot_held: boolean | null
  ballot_type: BallotType
  supplementary_triggered: boolean | null
  data_source: 'sgschooling'
  scrape_notes: string | null
}

function parseIntOrNull(val: string | null | undefined): number | null {
  if (!val || val.trim() === '-' || val.trim() === '') return null
  const n = parseInt(val.replace(/,/g, '').trim(), 10)
  return isNaN(n) ? null : n
}

// Extract total intake from "↳ Vacancy (210)" → 210
function parseTotalIntake(label: string): number | null {
  const m = label.match(/\((\d+)\)/)
  return m ? parseInt(m[1], 10) : null
}

// Extract ballot type from a cell like "69SC<1109/69" or "60PR<15/3"
// Valid codes: SC<1, SC1-2, SC>2, PR<1, PR1-2, SC<2#
const BALLOT_CODES: BallotType[] = ['SC<1', 'SC1-2', 'SC>2', 'PR<1', 'PR1-2', 'PR>2', 'SC<2#', 'PR<2#', 'SC#']

function extractBallotType(cell: string): { ballot_type: BallotType; ballot_held: boolean } {
  const trimmed = cell.trim()

  if (!trimmed || trimmed === '-') {
    return { ballot_type: null, ballot_held: false }
  }

  for (const code of BALLOT_CODES) {
    if (trimmed.includes(code)) {
      return { ballot_type: code, ballot_held: true }
    }
  }

  // Cell is a plain number — all spots taken without a ballot
  if (/^\d+$/.test(trimmed)) {
    return { ballot_type: 'no_ballot', ballot_held: false }
  }

  // Unknown pattern — flag it
  return { ballot_type: null, ballot_held: false }
}

async function scrapeYear(year: number): Promise<BallotRecord[]> {
  const records: BallotRecord[] = []
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const url = `${BASE_URL}/${year}/all`
  console.log(`\nScraping ${url}`)
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('table tbody tr', { timeout: 15000 })

  // Grab every row in the table
  const rows = await page.locator('table').first().locator('tbody tr').all()
  const allCells: string[][] = []
  for (const row of rows) {
    const cells = await row.locator('td').allTextContents()
    allCells.push(cells.map(c => c.trim()))
  }

  // Parse groups of 4 rows per school
  let i = 0
  while (i < allCells.length) {
    const row = allCells[i]
    if (!row || row.length === 0) { i++; continue }

    const label = row[0] ?? ''

    // Detect school header: not a sub-row (doesn't start with "↳")
    if (!label.startsWith('↳')) {
      const schoolName = label.trim()
      if (!schoolName) { i++; continue }

      // Expect next 3 rows to be Vacancy / Applied / Taken
      const vacancyRow = allCells[i + 1] ?? []
      const appliedRow = allCells[i + 2] ?? []
      const takenRow   = allCells[i + 3] ?? []

      const isVacancy = (vacancyRow[0] ?? '').startsWith('↳ Vacancy')
      const isApplied = (appliedRow[0] ?? '').startsWith('↳ Applied')
      const isTaken   = (takenRow[0]   ?? '').startsWith('↳ Taken')

      if (!isVacancy || !isApplied || !isTaken) {
        // Malformed group — skip and flag
        records.push({
          school_name: schoolName,
          year,
          total_p1_intake: null,
          phase2c_vacancies: null,
          phase2c_applicants: null,
          ballot_held: null,
          ballot_type: null,
          supplementary_triggered: null,
          data_source: 'sgschooling',
          scrape_notes: 'Malformed row group — manual review required',
        })
        i++
        continue
      }

      const totalIntake      = parseTotalIntake(vacancyRow[0])
      const phase2cVacancies = parseIntOrNull(vacancyRow[COL_2C])
      const phase2cApplicants = parseIntOrNull(appliedRow[COL_2C])
      const supp2csVacancies = parseIntOrNull(vacancyRow[COL_2CS])

      const takenCell = takenRow[COL_2C] ?? ''
      const { ballot_type, ballot_held } = extractBallotType(takenCell)

      const supplementaryTriggered = supp2csVacancies !== null && supp2csVacancies > 0

      const notes: string[] = []
      if (ballot_type === null && takenCell && takenCell !== '-') {
        notes.push(`Unrecognised taken cell: "${takenCell}"`)
      }

      records.push({
        school_name: schoolName,
        year,
        total_p1_intake: totalIntake,
        phase2c_vacancies: phase2cVacancies,
        phase2c_applicants: phase2cApplicants,
        ballot_held,
        ballot_type,
        supplementary_triggered: supplementaryTriggered,
        data_source: 'sgschooling',
        scrape_notes: notes.length > 0 ? notes.join('; ') : null,
      })

      i += 4  // consume all 4 rows
    } else {
      i++  // orphaned sub-row, skip
    }
  }

  await browser.close()
  console.log(`  Scraped ${records.length} school records for ${year}`)
  return records
}

async function main() {
  const allRecords: BallotRecord[] = []

  for (const year of YEARS) {
    const records = await scrapeYear(year)
    allRecords.push(...records)
  }

  const flagged = allRecords.filter(r => r.scrape_notes !== null)

  if (flagged.length > 0) {
    console.warn(`\n⚠️  ${flagged.length} records flagged for manual review:`)
    for (const r of flagged) {
      console.warn(`  ${r.school_name} (${r.year}): ${r.scrape_notes}`)
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allRecords, null, 2))
  console.log(`\n✅ Wrote ${allRecords.length} records to ${OUTPUT_PATH}`)
  console.log(`   Flagged: ${flagged.length} | Clean: ${allRecords.length - flagged.length}`)
  console.log(`   Expected ~537 records (179 schools × 3 years)`)
}

main().catch(err => {
  console.error('Scraper failed:', err)
  process.exit(1)
})
