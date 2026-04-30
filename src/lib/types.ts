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
}

export interface Filters {
  region: Region | 'All'
  access: PRColor | 'All'
  tier: 1 | 2 | 3 | 'All'
  gep: boolean
  sap: boolean
  alp: boolean
  ip: boolean
  emerging: boolean
  search: string
}

export type SortKey = 'name' | 'region' | 'pr_color' | 'quality_stars'
export type SortDir = 'asc' | 'desc'
