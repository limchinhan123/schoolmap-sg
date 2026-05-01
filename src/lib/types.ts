export type PRColor = 'green' | 'amber' | 'orange' | 'grey'
export type Region = 'North' | 'South' | 'East' | 'West' | 'Central'

export interface School {
  id: string
  name: string
  address: string
  region: Region
  gate_lat: number
  gate_lng: number
  is_autonomous: boolean
  is_gep_centre: boolean
  is_sap: boolean
  is_ip_pipeline: boolean
  alp_focus: string | null
  affiliated_secondary: string | null
  affiliated_sec_tier: string | null
  pr_color: PRColor
  pr_label: string
  pr_summary: string
  pr_limited_data: boolean
  quality_stars: 1 | 2 | 3
  avg_psf_1km: number | null
}

export type PsfBand = 'All' | 'budget' | 'mid' | 'premium'

export interface Filters {
  region: Region | 'All'
  access: PRColor | 'All'
  tier: 1 | 2 | 3 | 'All'
  gep: boolean
  sap: boolean
  alp: boolean
  ip: boolean
  emerging: boolean
  psf: PsfBand
  search: string
}

export type SortKey = 'name' | 'region' | 'pr_color' | 'quality_stars' | 'avg_psf_1km' | 'programmes'
export type SortDir = 'asc' | 'desc'

export interface BallotRound {
  year: number
  ballot_type: string
  phase2c_vacancies: number | null
  phase2c_applicants: number | null
  ballot_held: boolean
  supplementary_triggered: boolean
}

export interface NearbyProperty {
  source: 'hdb' | 'condo'
  property_name: string
  flat_type: string
  floor_area_sqft: number
  resale_price: number
  psf: number
  transaction_date: string
  remaining_lease_years: number | null
  distance_m: number
  floor_level: string | null
  tenure: string | null
}
