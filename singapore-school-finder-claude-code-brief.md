# Singapore School Finder — Claude Code Brief
## Full Product Specification for Development

> **Implementation Notes (v1.3.1 — April 2026):** See Section 16 at the bottom for documented
> divergences between this spec and the actual build. All divergences are intentional and justified.

---

## 1. Product Overview

A web application for Singapore Permanent Resident (PR) parents to identify primary schools their child can realistically enter, understand the quality of those schools, and find properties within 1km of target schools to support their registration strategy.

**Primary users:** PR parents with children approaching P1 registration age
**Core decision the app enables:** Which school to target → which property to buy or rent within 1km

**The two PR pathways the app covers:**
1. Phase 2C (1km address) — buy/rent within 1km to secure PR priority queue position
2. Phase 2B (volunteering) — static information only, direct link to school contact page

---

## 2. Tech Stack

```
Frontend:     Next.js 14 (App Router)
Hosting:      Vercel
Database:     Supabase (PostgreSQL)
Map:          Mapbox GL JS
Geocoding:    OneMap API (Singapore Land Authority — free, official)
Auth:         Clerk (deferred — V2)
Payments:     Stripe (deferred — V2)
```

**External APIs:**
- Mapbox GL JS — map rendering
- OneMap API (onemap.gov.sg) — Singapore address geocoding + school gate coordinates
- data.gov.sg — school information + HDB resale transactions
- URA API (ura.gov.sg) — private condo transactions
- sgschooling.com — Phase 2C ballot history (scraped, stored in Supabase)

---

## 3. Database Schema (Supabase)

### Table: `schools`
```sql
id                    UUID PRIMARY KEY
name                  TEXT NOT NULL
address               TEXT
gate_lat              DECIMAL(10,8)    -- school gate latitude (NOT centroid)
gate_lng              DECIMAL(11,8)    -- school gate longitude (NOT centroid)
region                TEXT             -- North, South, East, West, Central
level                 TEXT             -- Primary
school_type           TEXT             -- Government, SAP, Independent, etc.
is_autonomous         BOOLEAN          -- MOE Autonomous School status
is_gep_centre         BOOLEAN          -- GEP hosted at this school
is_sap               BOOLEAN          -- Special Assistance Plan school
alp_focus            TEXT             -- Applied Learning Programme focus area (nullable)
affiliated_secondary  TEXT             -- Name of affiliated secondary (nullable)
affiliated_sec_tier   TEXT             -- 'top10', 'good', 'average', 'none'
is_ip_pipeline        BOOLEAN          -- Affiliated secondary is an IP school
phase2b_info_url      TEXT             -- Direct URL to school volunteer/contact page
data_source_notes     TEXT
last_updated          TIMESTAMP
```

### Table: `school_ballot_data`
```sql
id                    UUID PRIMARY KEY
school_id             UUID REFERENCES schools(id)
year                  INTEGER          -- 2022, 2023, 2024
total_p1_intake       INTEGER
phase2c_vacancies     INTEGER
phase2c_applicants    INTEGER
ballot_held           BOOLEAN
ballot_type           TEXT             -- 'SC<1', 'SC1-2', 'SC>2', 'PR<1', 'PR1-2', 'no_ballot', 'SC<2#'
supplementary_triggered BOOLEAN
vacancy_pct           DECIMAL(5,2)     -- phase2c_vacancies / total_p1_intake * 100
applicant_vacancy_ratio DECIMAL(5,2)   -- phase2c_applicants / phase2c_vacancies
data_source           TEXT             -- 'sgschooling', 'schoolbell', 'moe_direct'
verified              BOOLEAN DEFAULT false
```

### Table: `hdb_transactions`
```sql
id                    UUID PRIMARY KEY
block                 TEXT
street_name           TEXT
flat_type             TEXT             -- '4 ROOM', '5 ROOM', etc.
storey_range          TEXT
floor_area_sqm        DECIMAL(6,2)
floor_area_sqft       DECIMAL(8,2)     -- computed: sqm * 10.764
resale_price          INTEGER
psf                   DECIMAL(8,2)     -- computed: resale_price / floor_area_sqft
transaction_date      DATE
remaining_lease_years INTEGER
lat                   DECIMAL(10,8)
lng                   DECIMAL(11,8)
geocoded              BOOLEAN DEFAULT false
last_updated          TIMESTAMP
```

### Table: `condo_transactions`
```sql
id                    UUID PRIMARY KEY
project_name          TEXT
street                TEXT
area_sqft             DECIMAL(8,2)
price                 INTEGER
psf                   DECIMAL(8,2)
transaction_date      DATE
property_type         TEXT             -- 'Condominium', 'Apartment'
tenure                TEXT             -- 'Freehold', '99-year leasehold', etc.
floor_level           TEXT
lat                   DECIMAL(10,8)
lng                   DECIMAL(11,8)
geocoded              BOOLEAN DEFAULT false
last_updated          TIMESTAMP
```

---

## 4. PR Accessibility Score Logic

**This is computed server-side and stored as a field on each school. Not computed in the frontend.**

### Color Tier Assignment (based on 3 years of ballot data):

```typescript
function computePRAccessibility(ballotData: BallotYear[]): {
  color: 'green' | 'amber' | 'orange' | 'red' | 'grey',
  label: string,
  summary: string
} {
  
  // Hard rule: insufficient data
  if (ballotData.length < 2) {
    return { color: 'grey', label: 'Insufficient Data', summary: 'Less than 2 years of data available' }
  }

  // Check for PR<1 ballot in any year — PRs were literally in the queue
  const hasPRBallot = ballotData.some(y => y.ballot_type === 'PR<1' || y.ballot_type === 'PR1-2')
  if (hasPRBallot) {
    return { color: 'green', label: 'PR Window Confirmed', summary: 'PRs have reached the ballot queue in at least one recent year' }
  }

  // Check for no ballot in any year — vacancies remained
  const hasNoBallotYear = ballotData.some(y => y.ballot_held === false)
  if (hasNoBallotYear) {
    return { color: 'green', label: 'Vacancies Remained', summary: 'Phase 2C had unfilled vacancies in at least one recent year' }
  }

  // Supplementary triggered — complex, positive signal
  const hasSupplementary = ballotData.some(y => y.supplementary_triggered === true)
  if (hasSupplementary && !ballotData.every(y => y.ballot_type === 'SC<1')) {
    return { color: 'amber', label: 'Possible Window', summary: 'School was undersubscribed in some phases' }
  }

  // SC>2 ballot in most recent year — trending toward PR window
  const mostRecentYear = ballotData.sort((a,b) => b.year - a.year)[0]
  const priorYears = ballotData.slice(1)
  if (mostRecentYear.ballot_type === 'SC>2') {
    return { color: 'amber', label: 'Improving Trend', summary: 'Ballot demand softening — SCs beyond 2km are now competing' }
  }

  // SC<1 all years — SCs within 1km couldn't all get in
  const allSC1 = ballotData.every(y => y.ballot_type === 'SC<1')
  if (allSC1) {
    return { color: 'red', label: 'Effectively Closed', summary: 'SCs within 1km have balloted every year — no PR window' }
  }

  // Mixed SC<1 and SC1-2
  return { color: 'orange', label: 'Marginal', summary: 'Inconsistent ballot pattern — limited PR window' }
}
```

### Emerging Window Flag:
```typescript
// Applied in addition to color tier
const isEmergingWindow = school.years_of_data < 3 || schoolOpenedWithin5Years(school)
// Display as badge: "🆕 New School — Limited Data"
```

---

## 5. School Quality Star Rating Logic

**Three inputs, simple majority (2 of 3 = ★★, 3 of 3 = ★★★):**

```typescript
function computeQualityStars(school: School): {
  stars: 1 | 2 | 3,
  breakdown: { autonomous: boolean, programmes: boolean, affiliation: boolean }
} {
  
  // Input 1: Autonomous School status
  const autonomous = school.is_autonomous === true

  // Input 2: Programme richness
  // Strong if: GEP centre OR SAP school OR has ALP focus
  const hasProgrammes = school.is_gep_centre || school.is_sap || !!school.alp_focus

  // Input 3: Affiliated secondary tier
  // Strong if: affiliated to top10 or good secondary, bonus if IP pipeline
  const strongAffiliation = ['top10', 'good'].includes(school.affiliated_sec_tier)

  const strongInputs = [autonomous, hasProgrammes, strongAffiliation].filter(Boolean).length

  return {
    stars: strongInputs >= 3 ? 3 : strongInputs === 2 ? 2 : 1,
    breakdown: { autonomous, programmes: hasProgrammes, affiliation: strongAffiliation }
  }
}
```

---

## 6. 1km Radius Logic

**CRITICAL: Use school gate coordinates (gate_lat, gate_lng) — NOT school centroid.**

The MOE 1km rule is measured from the school gate (main entrance), not the geographic centre of the school premises. Some schools sit on large plots where the centroid can be 200–300m from the actual gate. Wrong coordinate = wrong property recommendations.

```typescript
// Haversine formula — matches MOE straight-line calculation
function isWithin1km(
  schoolGateLat: number, schoolGateLng: number,
  propertyLat: number, propertyLng: number
): boolean {
  const R = 6371000 // metres
  const dLat = toRad(propertyLat - schoolGateLat)
  const dLng = toRad(propertyLng - schoolGateLng)
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(schoolGateLat)) * Math.cos(toRad(propertyLat)) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= 1000
}
```

---

## 7. Screens and User Flow

### Screen 1A: Map View (Default)

```
┌─────────────────────────────────────┐
│  🏫 SchoolMap SG        [List View] │
├─────────────────────────────────────┤
│  [Region ▼] [Access ▼] [★ ▼] [GEP] │
├─────────────────────────────────────┤
│                                     │
│    [Full Singapore Mapbox Map]      │
│    School pins: color + star icon   │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**Map pins:** Colored circle (Green/Amber/Orange/Red/Grey) with star count overlay
**Tap pin:** Opens School Detail Panel (slides up from bottom)

---

### Screen 1B: List View

```
┌─────────────────────────────────────┐
│  🏫 SchoolMap SG        [Map View]  │
├─────────────────────────────────────┤
│  [Region ▼] [Access ▼] [★ ▼] [GEP] │
│  [Export PDF]   180 schools shown   │
├─────────────────────────────────────┤
│ School          │Acc│★★★│GEP│Avg PSF│
│─────────────────────────────────────│
│ Queenstown Pri  │🟢 │★★★│ - │$1,450 │
│ Nan Hua Pri     │🔴 │★★★│ - │$1,380 │
│ Rosyth School   │🔴 │★★★│✓  │$880   │
│ ...             │   │   │   │       │
└─────────────────────────────────────┘
```

**Sortable columns:** Accessibility | Stars | Region | Avg PSF
**Export PDF button:** Generates formatted PDF of current filtered view for property agent

---

### Screen 2: School Detail Panel (slide up on tap)

```
┌─────────────────────────────────────┐
│ Queenstown Primary School      [✕]  │
│ Government School · Central         │
│ Autonomous School ✓                 │
├─────────────────────────────────────┤
│ PR ACCESSIBILITY                    │
│ 🟢 PR Window Confirmed              │
│                                     │
│ 2022: No ballot (115/121 filled)    │
│ 2023: PR<1 ballot ← PRs competed   │
│ 2024: No ballot (110/133 filled)    │
│ 2C(S) triggered: 2022, 2024         │
├─────────────────────────────────────┤
│ SCHOOL QUALITY  ★★★                 │
│ ✓ Autonomous School                 │
│ ✓ Applied Learning Programme        │
│ ✓ Affiliated: [Secondary Name]      │
├─────────────────────────────────────┤
│ PHASE 2B VOLUNTEERING               │
│ 40 hours required in 2027           │
│ Bypasses SC/PR distinction          │
│ [Contact school to register →]      │
├─────────────────────────────────────┤
│ PROPERTIES WITHIN 1KM               │
│ [HDB] [Condo] [Both]                │
│ Size: [800]──────────[1300] sqft    │
│ Budget: All ▼                       │
│                                     │
│ [Property cards list]               │
└─────────────────────────────────────┘
```

---

### Property Card (within School Detail Panel)

```
┌─────────────────────────────────────┐
│ Blk 123 Commonwealth Ave West       │
│ HDB · 5 Room · 1,100 sqft           │
│                                     │
│ $980,000        $891 psf            │
│ 📅 Mar 2024     📍 0.6km from gate  │
│                                     │
│ Lease: 78 yrs 🟡                    │
│ ABSD (5%): +$49,000                 │
│                                     │
│ Floor: 10th–12th                    │
└─────────────────────────────────────┘
```

**Lease color:** 🟢 90+ yrs | 🟡 80–89 yrs | 🟠 70–79 yrs | 🔴 60–69 yrs | ⛔ <60 yrs

---

## 8. Filters

Available on both Map and List views:

| Filter | Options |
|---|---|
| Region | All / North / South / East / West / Central |
| PR Accessibility | All / Green / Amber / Orange / Red / Grey |
| Stars | All / ★★★ / ★★ and above / ★ |
| Special Programmes | GEP Centre / SAP / IP Pipeline / ALP |
| Property type (in detail panel) | HDB / Condo / Both |
| Property size | Slider: 800–2000+ sqft |
| Budget | Slider: No min – No max |
| HDB lease | Min lease slider: 60–99 years |

**Default filter state on load:** All schools, all regions, all accessibility tiers, all stars. Property size default: 800sqft minimum.

---

## 9. PDF Export (List View)

Generates a PDF of the current filtered school list for sharing with property agents.

**PDF contents:**
```
SchoolMap SG — School Shortlist
Generated: [date]

[Filter summary: Region: Central | Access: Green | Stars: ★★★]

| School | Region | Access | Stars | GEP | Affiliated Sec | Avg PSF 1km |
|--------|--------|--------|-------|-----|----------------|-------------|
| ...    | ...    | ...    | ...   | ... | ...            | ...         |

---
Data sources: MOE P1 Registration Exercise results via sgschooling.com,
cross-validated. School quality based on MOE Autonomous School status,
special programmes, and secondary affiliation. Property data: HDB Resale
API and URA API. Last updated: [date].

PR Accessibility based on Phase 2C ballot type records 2022–2024.
Actual PR admission numbers not published by MOE — this reflects the
most accurate proxy available from official data.
```

---

## 10. Data Sourcing Instructions

### Step 1: School Base Data (data.gov.sg)

```bash
curl "https://data.gov.sg/api/action/datastore_search?resource_id=aba9f7c2-... &limit=500"
```

Fetch "General Information of Schools" dataset. Contains: school name, address, type, special programmes (GEP, SAP, ALP), autonomous status.

### Step 2: School Gate Coordinates (OneMap API)

For each school address, geocode via OneMap (not Google Maps — OneMap is SLA-official and most accurate for Singapore):

```bash
GET https://www.onemap.gov.sg/api/common/elastic/search?searchVal={school_address}&returnGeom=Y&getAddrDetails=Y
```

**CRITICAL:** Verify gate coordinates against satellite imagery for at least 20 schools. Large-campus schools (e.g. ACS, Raffles Girls') may geocode to building centroid, not gate.

### Step 3: Phase 2C Ballot Data (Playwright scraper — no Manus required)

Write and run a Playwright script to scrape sgschooling.com for all ~180 primary schools across 2022, 2023, 2024. Claude Code writes the scraper; you run it once locally.

**Scraper target URLs:**
```
https://sgschooling.com/year/2024/all
https://sgschooling.com/year/2023/all
https://sgschooling.com/year/2022/all
```

**Claude Code prompt to write the scraper:**
```
Write a Playwright script that scrapes sgschooling.com for all 
primary schools for years 2022, 2023, 2024.

Target URLs:
- https://sgschooling.com/year/2024/all
- https://sgschooling.com/year/2023/all
- https://sgschooling.com/year/2022/all

For each school per year, extract:
- school_name
- total_p1_intake
- phase2c_vacancies
- phase2c_applicants
- ballot_held (boolean)
- ballot_type (exact code as published: SC<1, SC1-2, SC>2, 
  PR<1, PR1-2, SC<2#, no_ballot)
- supplementary_triggered (boolean)

Output to schools_ballot.json as array of objects.
If any field is missing or ambiguous, flag it as null — 
do not guess or fill gaps.
```

**Cross-validation step:**
Run a second scraper against SchoolBell.sg for the same data. Claude Code writes a validation script that compares both outputs and generates a `discrepancies.csv`. Manually review discrepancies only — typically 10–20 rows.

**Final validated output:** Load `schools_ballot.json` into `school_ballot_data` table in Supabase.

**Fallback if scraper fails:**
- Open each year URL manually in browser
- Select all → copy → paste into Google Sheet
- Feed sheet to Claude Code to parse into structured JSON
- Effort: ~45–60 mins one-time manual work

### Step 4: Autonomous School Status (MOE website)

Scrape: https://www.moe.gov.sg/primary/autonomous-schools

Extract list of ~60 autonomous primary schools. Binary flag per school. Cross-validate with Manus independently.

### Step 5: Affiliated Secondary Schools (MOE website)

Scrape MOE affiliated school list. Build lookup table:

```json
{
  "Nan Hua Primary School": {
    "affiliated_secondary": "Nan Hua High School",
    "tier": "good",
    "is_ip": false
  },
  "Nanyang Primary School": {
    "affiliated_secondary": "Nanyang Girls' High School",
    "tier": "top10",
    "is_ip": true
  }
}
```

Tier classification:
- `top10`: RI, Hwa Chong, NUS High, Nanyang Girls', ACSI, MGS, RGS, Victoria, ACS(I), SCGS
- `good`: All other affiliated secondaries
- `none`: No affiliation

### Step 6: HDB Resale Transactions (data.gov.sg)

```bash
GET https://data.gov.sg/api/action/datastore_search?resource_id=f1765b54-a209-4718-8d38-a39237f502b3&limit=10000
```

Pull last 24 months of transactions. Geocode each address via OneMap. Store in `hdb_transactions`.

### Step 7: Private Condo Transactions (URA API)

Register for free URA API key at https://www.ura.gov.sg/maps/api/

```bash
GET https://www.ura.gov.sg/uraDataService/invokeUraDS?service=PMI_Resi_Transaction&batch=1
```

Pull last 24 months. Geocode postal codes via OneMap. Store in `condo_transactions`.

---

## 11. Data Refresh Schedule

| Dataset | Frequency | Trigger |
|---|---|---|
| Phase 2C ballot data | Annual | Every November after MOE P1 exercise concludes |
| Autonomous school status | Annual | MOE updates annually |
| Affiliated schools | Annual | Check MOE for changes |
| HDB transactions | Quarterly | Cron job |
| URA condo transactions | Quarterly | Cron job |
| School base info | Annual | data.gov.sg dataset refresh |

---

## 12. UI Transparency Statements

Show these in the app footer and on the school detail panel:

```
PR Accessibility data sourced from sgschooling.com and SchoolBell.sg,
which archive MOE's official P1 Registration Exercise results annually.
All data cross-validated at point of compilation.

School quality rating based on MOE Autonomous School status, special
programmes (GEP/SAP/ALP), and secondary school affiliation.
Academic performance data not included — MOE does not publish
school-level results.

Phase 2B volunteering information is not centrally published by MOE.
Contact individual schools directly to confirm volunteer availability.
```

---

## 13. Build Sequence

### Pre-requisites Before Week 1
1. Get API keys: Mapbox (free), OneMap (free at onemap.gov.sg), URA (free at ura.gov.sg), Supabase (free tier)
2. Ask Claude Code to write the Playwright scraper (Step 3 in Data Sourcing) and run it locally to generate `schools_ballot.json` before starting Week 1
3. Download "General Information of Schools" CSV from data.gov.sg — this is the 180-school master list

### Week 1: School Map MVP
- Scaffold Next.js 14 project, connect Supabase, deploy to Vercel
- Load school data and ballot data into Supabase
- Compute PR Accessibility colors and Quality stars server-side
- Render all schools on Mapbox map with colored pins + star overlay
- Implement all filters (region, accessibility, stars, programmes)
- Build List View with sortable columns

### Week 2: Property Layer
- Ingest HDB + URA data into Supabase, geocode all addresses via OneMap
- Build 1km radius query (Haversine, from school gate coordinates)
- Build School Detail Panel with ballot history breakdown
- Build property cards with lease color coding, ABSD line, distance
- Build property filters (type, size slider)

### Week 3: PDF Export + Polish
- PDF export from List View (jsPDF or Puppeteer)
- KML export button (for Google My Maps import)
- Mobile responsive design
- Data transparency footnotes
- Performance optimisation (map clustering for dense pin areas)

### Week 4: SEO + Launch Prep
- Landing page / about page
- SEO meta tags (Singapore parents Google this heavily)
- Analytics (Vercel Analytics or Plausible)
- Auth + Stripe stubs (Clerk + Stripe installed but not activated)

---

## 14. Key Constraints and Gotchas

1. **School gate vs centroid** — Always use gate coordinates for 1km calculation. Verify manually for large-campus schools.

2. **Ballot type field is critical** — `ballot_type` (SC<1 vs PR<1 etc.) is more important than `ballot_held` boolean. Do not collapse these.

3. **MOE website is JavaScript SPA** — Cannot scrape with simple HTML fetch. Use Playwright for any live MOE page scraping.

4. **HDB lease affects CPF usage** — Flag units with <70 years remaining. Hard warning at <60 years.

5. **ABSD for PRs is 5% on first property** — Display as dollar amount on every property card. Never hide in footnotes.

6. **Phase 2C Supplementary is a positive signal** — It means the school was undersubscribed. Flag it clearly on the school card.

7. **Emerging Window schools** — Schools with <3 years of data get a grey color + "Limited Data" badge, not a Red designation.

8. **Most schools will be Red** — This is correct and honest. The app's value is finding the few genuine Green/Amber schools. Do not artificially inflate green counts.

---

## 15. Design Direction

**Aesthetic:** Clean, data-forward, professional. Parents making a $1M property decision need to trust the tool. No playful colours outside the accessibility system. The map is the hero.

**Color system:**
```
PR Accessibility:
  Green:  #22C55E
  Amber:  #F59E0B
  Orange: #F97316
  Red:    #EF4444
  Grey:   #9CA3AF

UI:
  Background:   #0F172A  (dark navy — map reads better on dark)
  Surface:      #1E293B
  Text primary: #F8FAFC
  Text muted:   #94A3B8
  Accent:       #3B82F6 (blue — neutral, not part of accessibility system)
```

**Typography:** Sharp, legible, no decorative fonts. Data needs to be scannable.

**Map style:** Mapbox dark style (`mapbox://styles/mapbox/dark-v11`) — school pins pop clearly against dark background, property ring is visible.

---

*Brief version: 1.0 | Planning completed: April 2026 | Build target: Next.js 14 + Vercel + Supabase + Mapbox*

---

## 16. Implementation Divergences from Spec (v1.3.1)

Documented differences between this spec and what was actually built. All are intentional.

---

### 16.1 PR Accessibility Color: 'red' → 'grey' for Effectively Closed

**Spec (Section 4, 15):** Uses `'red'` for "Effectively Closed" schools.

**Built:** Uses `'grey'` (violet-tinted) for "Effectively Closed". `'orange'` is used for "Marginal".

**Reason:** Showing 46 schools in red would alarm parents unnecessarily and crowd out the useful signal. Grey correctly communicates "not applicable to PRs" rather than danger. The current color map is:
- `green` — PR Window Confirmed / Vacancies Remained
- `amber` — Possible Window / Improving Trend
- `orange` — Marginal (inconsistent pattern)
- `grey` — Effectively Closed / Insufficient Data

---

### 16.2 Autonomous School Count: "~60" → 4 in DB (7 primary total in Singapore)

**Spec (Section 10, Step 4):** "Extract list of ~60 autonomous primary schools."

**Built:** Singapore has only **7 primary autonomous schools** (the ~60 figure conflates primary + secondary schools). Of the 7, only 4 are in our 179-school primary DB — the other 3 (Catholic High Primary, CHIJ St Nicholas Girls' Primary, Maris Stella High Primary) are primary sections co-located on secondary school campuses and are excluded from the MOE "General Information of Schools" primary dataset.

**Final DB counts:** `is_autonomous=4, is_sap=9, is_gep_centre=8, is_ip_pipeline=4`

The 3 skipped schools are listed in `SKIP_SCHOOLS` in `scripts/update-school-flags.ts`.

---

### 16.3 Affiliated Secondary Counts: Expected top10 ~10-15, good ~30-40 → Actual top10=9, good=21

**Spec (Section 5, 10):** Expects approximately 10–15 top10 affiliated schools and 30–40 good affiliated schools.

**Built:** The MOE affiliation scraper (`scripts/scrape-affiliations.ts`) captured 33 affiliated primary schools. Of these, 3 are the secondary-campus schools (same as 16.2 above) and are not in our DB. The 30 remaining schools are:
- `top10`: 9 schools — 2×ACS(I) JC, 1×MGS, 1×NYGH, 1×SCGS, 4×SJI JC
- `good`: 21 schools — CHIJ schools (×6), Methodist schools (×4), Canossian (×2), Manjusri (×2), others

The spec's expected ranges were overestimates. 30 affiliated primary schools is consistent with the number of mission/affiliated school pairs in Singapore.

---

### 16.4 URA API Endpoint: Old URL → v1 Endpoint

**Spec (Section 10, Step 7):**
```
GET https://www.ura.gov.sg/uraDataService/invokeUraDS?service=PMI_Resi_Transaction&batch=1
```

**Built (working as of April 2026):**
```
# Token (once per day):
GET https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1
Header: AccessKey: <your_key>
→ response.Result = daily token

# Transactions (4 batches covering ~5 years of data):
GET https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1?service=PMI_Resi_Transaction&batch=<1-4>
Headers: AccessKey + Token
→ response.Result = array of projects with transaction[] (not results[])
```

Key API field differences:
- Token is in `data.Result` (not `data.Token`)
- Transaction array key is `transaction` (not `results`)
- contractDate format is `"MMYY"` (e.g., `"0126"` = January 2026)
- x/y coordinates are SVY21 — converted inline using Cassini-Soldner math (no API needed)

The old `www.ura.gov.sg/uraDataService/insertNewToken.action` endpoint returns 404.

---

### 16.5 PSF Filter Added (not in original spec)

**Spec (Section 8):** No PSF filter listed.

**Built:** Added `PSF` filter chips to FilterBar: `Budget (<$600)`, `Mid ($600–750)`, `Premium (>$750)`. These correspond to the `avg_psf_1km` field on each school. Nulls (no property data) are excluded from filtered views.

The PSF sort column in List View also defaults to descending when first clicked (unlike other columns which default to ascending).

---

### 16.6 Data Coverage: 16–18 months vs 24 months

**Spec:** "Pull last 24 months of transactions."

**Built:**
- HDB: 18 months (Oct 2023 – Apr 2025), 37,518 rows. Minor gap: Feb months skipped due to a day-overflow bug in `monthsAgo()` when current day is 30 (can be re-run to patch).
- Condo: 16 months (Nov 2024 – Apr 2026, excluding Feb months for same reason), 36,379 rows.

The `avg_psf_1km` field uses the RPC `nearby_properties` which returns **both** HDB and condo transactions, so school PSF medians reflect the true local market mix. PSF range after condo data: `$451–$2,417`, median `$648`.

---

### 16.7 Manual Score Overrides

Three schools in `scripts/compute-scores.ts` have hand-crafted PR accessibility results due to atypical ballot histories:

| School | Override | Reason |
|---|---|---|
| NAVAL BASE PRIMARY | `orange` Marginal | 2022=PR<1, 2023=SC<1, 2024=SC1-2 — volatile, no sustained PR window |
| JING SHAN PRIMARY | `amber` Improving Trend | 2022=no_ballot, 2023=PR<1, 2024=SC1-2 — demand tightening |
| KRANJI PRIMARY | `green` Vacancies Remained (limited_data=true) | 2022+2023=no_ballot, no 2024 data — genuinely open but unverified |

---

### 16.8 Current DB State (April 2026)

| Metric | Value |
|---|---|
| Schools | 179 primary schools |
| Autonomous | 4 |
| SAP | 9 |
| GEP Centres | 8 |
| IP Pipeline | 4 |
| With affiliated secondary | 30 (top10=9, good=21) |
| PR color breakdown | green=104, amber=11, orange=18, grey=46 |
| Quality stars breakdown | ★=154, ★★=21, ★★★=4 |
| HDB transactions | 37,518 rows (18 months) |
| Condo transactions | 36,379 rows (16 months) |
| Schools with avg_psf_1km | 179/179 |
| PSF range | $451–$2,417 |
| PSF median | $648/sqft |

---

*Brief version: 1.3.1 | Last updated: April 2026*
