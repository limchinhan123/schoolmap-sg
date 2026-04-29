/**
 * scrape-ballot.ts
 * Scrapes sgschooling.com for Phase 2C ballot data for all primary schools,
 * years 2022–2024. Outputs to scripts/schools_ballot_raw.json.
 *
 * DO NOT RUN until you have confirmed sgschooling.com structure is as expected.
 *
 * Prerequisites:
 *   npm install -D playwright
 *   npx playwright install chromium
 *
 * Usage:
 *   npx tsx scripts/scrape-ballot.ts
 */

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const YEARS = [2024, 2023, 2022]
const BASE_URL = 'https://sgschooling.com/year'
const OUTPUT_PATH = path.resolve('scripts/schools_ballot_raw.json')

// Ballot type codes as published by MOE / sgschooling
type BallotType = 'SC<1' | 'SC1-2' | 'SC>2' | 'PR<1' | 'PR1-2' | 'SC<2#' | 'no_ballot' | null

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
  scrape_notes: string | null   // flag anything ambiguous rather than guessing
}

function parseIntOrNull(val: string | null | undefined): number | null {
  if (!val) return null
  const n = parseInt(val.replace(/,/g, '').trim(), 10)
  return isNaN(n) ? null : n
}

function parseBallotType(raw: string | null | undefined): BallotType {
  if (!raw) return null
  const cleaned = raw.trim()
  const valid: BallotType[] = ['SC<1', 'SC1-2', 'SC>2', 'PR<1', 'PR1-2', 'SC<2#', 'no_ballot']
  return valid.includes(cleaned as BallotType) ? (cleaned as BallotType) : null
}

async function scrapeYear(year: number): Promise<BallotRecord[]> {
  const records: BallotRecord[] = []
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const url = `${BASE_URL}/${year}/all`
  console.log(`\nScraping ${url}`)
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

  // Wait for school rows — sgschooling renders a table per school
  // Selector may need adjustment if site structure changes
  await page.waitForSelector('table', { timeout: 15000 })

  // Each school block has a heading and a data table.
  // Grab all school sections on the page.
  const schoolBlocks = await page.locator('.school-block, [class*="school"], article').all()

  if (schoolBlocks.length === 0) {
    // Fallback: try parsing a flat table with one row per school
    console.warn(`  No school blocks found with primary selector — trying table rows`)
    const rows = await page.locator('table tbody tr').all()
    for (const row of rows) {
      const cells = await row.locator('td').allTextContents()
      if (cells.length < 5) continue

      const [schoolName, intakeRaw, vacanciesRaw, applicantsRaw, ballotTypeRaw, suppRaw] = cells

      const ballotType = parseBallotType(ballotTypeRaw)
      const phase2cVacancies = parseIntOrNull(vacanciesRaw)
      const phase2cApplicants = parseIntOrNull(applicantsRaw)
      const ballotHeld = ballotType !== 'no_ballot' && ballotType !== null

      records.push({
        school_name: schoolName.trim(),
        year,
        total_p1_intake: parseIntOrNull(intakeRaw),
        phase2c_vacancies: phase2cVacancies,
        phase2c_applicants: phase2cApplicants,
        ballot_held: ballotHeld,
        ballot_type: ballotType,
        supplementary_triggered: suppRaw ? suppRaw.toLowerCase().includes('yes') : null,
        data_source: 'sgschooling',
        scrape_notes: ballotType === null ? `Unrecognised ballot type: "${ballotTypeRaw}"` : null,
      })
    }
  } else {
    // Primary path: school blocks with embedded table
    for (const block of schoolBlocks) {
      const schoolName = (await block.locator('h2, h3, [class*="name"]').first().textContent())?.trim() ?? null
      if (!schoolName) continue

      const cells = await block.locator('td').allTextContents()
      if (cells.length === 0) continue

      // Expected cell order varies — extract by label when possible
      let intakeRaw: string | null = null
      let vacanciesRaw: string | null = null
      let applicantsRaw: string | null = null
      let ballotTypeRaw: string | null = null
      let suppRaw: string | null = null

      // Try label-based extraction
      const labels = await block.locator('th, td[class*="label"]').allTextContents()
      const values = await block.locator('td:not([class*="label"])').allTextContents()

      for (let i = 0; i < labels.length; i++) {
        const label = labels[i].toLowerCase()
        const val = values[i] ?? null
        if (label.includes('intake') || label.includes('p1 places')) intakeRaw = val
        else if (label.includes('vacanc')) vacanciesRaw = val
        else if (label.includes('applicant')) applicantsRaw = val
        else if (label.includes('ballot type') || label.includes('phase')) ballotTypeRaw = val
        else if (label.includes('supplement')) suppRaw = val
      }

      // If label extraction failed, fall back to positional
      if (!ballotTypeRaw && cells.length >= 4) {
        [intakeRaw, vacanciesRaw, applicantsRaw, ballotTypeRaw, suppRaw] = cells
      }

      const ballotType = parseBallotType(ballotTypeRaw)
      const phase2cVacancies = parseIntOrNull(vacanciesRaw)
      const phase2cApplicants = parseIntOrNull(applicantsRaw)
      const ballotHeld = ballotType !== 'no_ballot' && ballotType !== null

      const notes: string[] = []
      if (ballotType === null && ballotTypeRaw) notes.push(`Unrecognised ballot type: "${ballotTypeRaw}"`)
      if (intakeRaw === null) notes.push('intake missing')
      if (vacanciesRaw === null) notes.push('vacancies missing')

      records.push({
        school_name: schoolName,
        year,
        total_p1_intake: parseIntOrNull(intakeRaw),
        phase2c_vacancies: phase2cVacancies,
        phase2c_applicants: phase2cApplicants,
        ballot_held: ballotHeld,
        ballot_type: ballotType,
        supplementary_triggered: suppRaw ? suppRaw.toLowerCase().includes('yes') : null,
        data_source: 'sgschooling',
        scrape_notes: notes.length > 0 ? notes.join('; ') : null,
      })
    }
  }

  await browser.close()
  console.log(`  Scraped ${records.length} records for ${year}`)
  return records
}

async function main() {
  const allRecords: BallotRecord[] = []

  for (const year of YEARS) {
    const records = await scrapeYear(year)
    allRecords.push(...records)
  }

  // Flag any records with ambiguous/missing data
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
}

main().catch(err => {
  console.error('Scraper failed:', err)
  process.exit(1)
})
