import type { PsfBand } from './types'

/**
 * Single source of truth for PSF thresholds (S$/sqft).
 *
 * Applied to schools.avg_psf_1km — the blended HDB+condo median of the
 * ~100 nearest transactions within 1km of the school gate. Recalibrate
 * these cutoffs against the actual distribution whenever property data
 * is re-ingested (see scripts/compute-avg-psf.ts).
 */
export const PSF_BANDS = {
  budgetMax: 600, // avg_psf_1km below this → 'budget'
  midMax: 750,    // below this → 'mid'; at or above → 'premium'
}

/** Heat-gradient steps for the list-view PSF column (4 colour stops). */
export const PSF_HEAT_STEPS = [550, 700, 850]

export function psfBandOf(psf: number): Exclude<PsfBand, 'All'> {
  if (psf < PSF_BANDS.budgetMax) return 'budget'
  if (psf < PSF_BANDS.midMax) return 'mid'
  return 'premium'
}

/** Filter predicate: does a school's avg PSF fall in the selected band? */
export function matchesPsfBand(band: PsfBand, avgPsf: number | null): boolean {
  if (band === 'All') return true
  if (avgPsf == null) return false
  return psfBandOf(avgPsf) === band
}
