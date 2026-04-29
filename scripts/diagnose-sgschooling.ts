/**
 * diagnose-sgschooling.ts
 * Dumps the raw HTML of the first school block on sgschooling.com
 * so we can understand the exact table structure before rewriting the scraper.
 *
 * Usage: npx tsx scripts/diagnose-sgschooling.ts
 */

import { chromium } from 'playwright'
import fs from 'fs'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto('https://sgschooling.com/year/2024/all', {
    waitUntil: 'networkidle',
    timeout: 30000,
  })

  await page.waitForSelector('table', { timeout: 15000 })

  // Dump first 8000 chars of page HTML so we can see the structure
  const html = await page.content()
  fs.writeFileSync('scripts/sgschooling_page.html', html)
  console.log('Saved full HTML to scripts/sgschooling_page.html')

  // Also dump all table headers to understand columns
  const headers = await page.locator('th').allTextContents()
  console.log('\nAll <th> text:', JSON.stringify(headers, null, 2))

  // Dump the first 20 rows of the first table
  const rows = await page.locator('table').first().locator('tr').all()
  console.log(`\nFirst ${Math.min(rows.length, 25)} rows:`)
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cells = await rows[i].locator('td, th').allTextContents()
    console.log(`  Row ${i}: ${JSON.stringify(cells)}`)
  }

  await browser.close()
}

main().catch(console.error)
