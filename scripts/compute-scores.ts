/**
 * compute-scores.ts
 * Reads all schools + their ballot data from Supabase, computes:
 *   - pr_color, pr_label, pr_summary, pr_limited_data  (PR Accessibility)
 *   - quality_stars                                     (School Quality)
 * then writes the results back to the schools table.
 *
 * Run this AFTER:
 *   1. load-schools.ts         (schools table populated)
 *   2. scrape-ballot.ts        (schools_ballot_raw.json produced)
 *   3. load-ballot.ts          (school_ballot_data table populated — see note below)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/compute-scores.ts
 */

import { createClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

type PRColor = 'green' | 'amber' | 'orange' | 'red' | 'grey'

interface BallotYear {
  year: number
  ballot_held: boolean | null
  ballot_type: string | null
  supplementary_triggered: boolean | null
}

interface School {
  id: string
  name: string
  is_autonomous: boolean
  is_gep_centre: boolean
  is_sap: boolean
  alp_focus: string | null
  affiliated_sec_tier: string | null
  is_ip_pipeline: boolean
}

interface PRResult {
  pr_color: PRColor
  pr_label: string
  pr_summary: string
  pr_limited_data: boolean
}

interface QualityResult {
  quality_stars: 1 | 2 | 3
}

// ─── PR Accessibility (Section 4 of brief) ───────────────────────────────────

function computePRAccessibility(ballotData: BallotYear[]): PRResult {
  // Emerging window: school opened recently or <2 years of data
  if (ballotData.length < 2) {
    return {
      pr_color: 'grey',
      pr_label: 'Insufficient Data',
      pr_summary: 'Less than 2 years of ballot data available',
      pr_limited_data: true,
    }
  }

  const limited = ballotData.length < 3

  // PR<1, PR1-2, PR>2 in any year — PRs literally reached the ballot queue
  // PR>2 is the strongest signal: even PRs beyond 2km got to ballot
  const hasPRBallot = ballotData.some(
    y => y.ballot_type === 'PR<1' || y.ballot_type === 'PR1-2' || y.ballot_type === 'PR>2'
  )
  if (hasPRBallot) {
    return {
      pr_color: 'green',
      pr_label: 'PR Window Confirmed',
      pr_summary: 'PRs have reached the ballot queue in at least one recent year',
      pr_limited_data: limited,
    }
  }

  // No ballot held in any year — vacancies remained unfilled
  const hasNoBallotYear = ballotData.some(y => y.ballot_held === false)
  if (hasNoBallotYear) {
    return {
      pr_color: 'green',
      pr_label: 'Vacancies Remained',
      pr_summary: 'Phase 2C had unfilled vacancies in at least one recent year',
      pr_limited_data: limited,
    }
  }

  // Supplementary triggered + not all SC<1 — undersubscribed signal
  const hasSupplementary = ballotData.some(y => y.supplementary_triggered === true)
  const allSC1 = ballotData.every(y => y.ballot_type === 'SC<1')
  if (hasSupplementary && !allSC1) {
    return {
      pr_color: 'amber',
      pr_label: 'Possible Window',
      pr_summary: 'School was undersubscribed in some phases — supplementary round triggered',
      pr_limited_data: limited,
    }
  }

  // Most recent year is SC>2 — demand softening, PRs may get in
  const sorted = [...ballotData].sort((a, b) => b.year - a.year)
  const mostRecent = sorted[0]
  if (mostRecent.ballot_type === 'SC>2') {
    return {
      pr_color: 'amber',
      pr_label: 'Improving Trend',
      pr_summary: 'Ballot demand softening — SCs beyond 2km are now competing, PR window may emerge',
      pr_limited_data: limited,
    }
  }

  // SC<1 every year — SCs within 1km couldn't all get in; no PR window
  if (allSC1) {
    return {
      pr_color: 'red',
      pr_label: 'Effectively Closed',
      pr_summary: 'SCs within 1km have balloted every year — no PR window',
      pr_limited_data: limited,
    }
  }

  // Mixed SC<1 and SC1-2 — inconsistent, marginal
  return {
    pr_color: 'orange',
    pr_label: 'Marginal',
    pr_summary: 'Inconsistent ballot pattern — limited PR window, outcome uncertain',
    pr_limited_data: limited,
  }
}

// ─── Quality Stars (Section 5 of brief) ──────────────────────────────────────

function computeQualityStars(school: School): QualityResult {
  // Input 1: MOE Autonomous School status
  const autonomous = school.is_autonomous === true

  // Input 2: Programme richness — GEP centre OR SAP OR has ALP focus
  const hasProgrammes = school.is_gep_centre || school.is_sap || !!school.alp_focus

  // Input 3: Affiliated secondary tier — top10 or good = strong
  const strongAffiliation = ['top10', 'good'].includes(school.affiliated_sec_tier ?? '')

  const strongCount = [autonomous, hasProgrammes, strongAffiliation].filter(Boolean).length

  return {
    quality_stars: strongCount >= 3 ? 3 : strongCount === 2 ? 2 : 1,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Missing env vars. Run: npx tsx --env-file=.env.local scripts/compute-scores.ts')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  // Fetch all schools
  const { data: schools, error: schoolErr } = await supabase
    .from('schools')
    .select('id, name, is_autonomous, is_gep_centre, is_sap, alp_focus, affiliated_sec_tier, is_ip_pipeline')
    .eq('level', 'Primary')

  if (schoolErr || !schools) {
    console.error('Failed to fetch schools:', schoolErr?.message)
    process.exit(1)
  }

  // Fetch all ballot data
  const { data: allBallot, error: ballotErr } = await supabase
    .from('school_ballot_data')
    .select('school_id, year, ballot_held, ballot_type, supplementary_triggered')

  if (ballotErr || !allBallot) {
    console.error('Failed to fetch ballot data:', ballotErr?.message)
    process.exit(1)
  }

  // Group ballot data by school_id
  const ballotBySchool = new Map<string, BallotYear[]>()
  for (const row of allBallot) {
    const list = ballotBySchool.get(row.school_id) ?? []
    list.push({
      year: row.year,
      ballot_held: row.ballot_held,
      ballot_type: row.ballot_type,
      supplementary_triggered: row.supplementary_triggered,
    })
    ballotBySchool.set(row.school_id, list)
  }

  console.log(`Computing scores for ${schools.length} schools...\n`)

  let updated = 0
  let errors = 0

  for (const school of schools) {
    const ballotData = ballotBySchool.get(school.id) ?? []
    const pr = computePRAccessibility(ballotData)
    const quality = computeQualityStars(school)

    const { error: updateErr } = await supabase
      .from('schools')
      .update({
        pr_color: pr.pr_color,
        pr_label: pr.pr_label,
        pr_summary: pr.pr_summary,
        pr_limited_data: pr.pr_limited_data,
        quality_stars: quality.quality_stars,
        last_updated: new Date().toISOString(),
      })
      .eq('id', school.id)

    if (updateErr) {
      console.error(`  ✗ ${school.name}: ${updateErr.message}`)
      errors++
    } else {
      console.log(`  ✓ ${school.name} — PR: ${pr.pr_color} (${pr.pr_label}) | ★${'★'.repeat(quality.quality_stars - 1)} (${quality.quality_stars})`)
      updated++
    }
  }

  // Summary
  console.log(`\n✅ Updated ${updated}/${schools.length} schools (${errors} errors)`)

  const { data: summary } = await supabase
    .from('schools')
    .select('pr_color, quality_stars')
    .eq('level', 'Primary')

  if (summary) {
    const prCounts: Record<string, number> = {}
    const starCounts: Record<number, number> = {}
    for (const row of summary) {
      prCounts[row.pr_color ?? 'null'] = (prCounts[row.pr_color ?? 'null'] ?? 0) + 1
      starCounts[row.quality_stars ?? 0] = (starCounts[row.quality_stars ?? 0] ?? 0) + 1
    }
    console.log('\nPR color breakdown:', prCounts)
    console.log('Quality stars breakdown:', starCounts)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
