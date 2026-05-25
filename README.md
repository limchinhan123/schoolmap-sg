# School Hunt for SG PR 🏫

**Which primary school got chance to enter ah?**

A map and list tool for Singapore Permanent Residents navigating the P1 registration process. See Phase 2C ballot history for every primary school, filter by PR accessibility, and cross-reference nearby property prices — before you sign the lease.

🔗 **Live:** [schoolmap-sg.vercel.app/?v=1](https://schoolmap-sg.vercel.app/?v=1)

---

## What It Does

- **Map view** — colour-coded pins (green / amber / orange / purple) showing each school's PR accessibility, with Mapbox clustering at lower zoom levels
- **List view** — sortable table with school name, region, PR access tier, quality stars, programmes (GEP / SAP / ALP / IP), and avg PSF within 1km
- **Filters** — multi-select PR access, region, quality tier, programmes, property zone; search by name; reset all
- **School detail panel** — Phase 2C ballot history by year, nearby HDB and condo transactions, affiliated secondary school

---

## PR Access Scoring

Each school is scored from Phase 2C ballot data (2022–2024) and assigned one of four tiers:

| Colour | Label | Meaning |
|--------|-------|---------|
| 🟢 Green | Open / Vacancies Remained | PRs have reached Phase 2C ballot, or vacancies remained for 2+ consecutive years |
| 🟡 Amber | Possible / Recently Cleared | Demand softening — a window may be opening |
| 🟠 Orange | Marginal | Patchy history — occasional chance, not reliable |
| 🟣 Purple | Closed | Oversubscribed by SCs — no realistic PR window |
| ⚪ Grey | Emerging | New school or limited data |

> **Transparency note:** Scoring is a model, not ground truth. The thresholds (e.g. requiring 2+ no-ballot years for "green") are deliberate judgment calls. Phase 2C ballot data (2022–2024) was validated against sgschooling.com. MOE historical data has no public API — validation confirms import accuracy only, not source accuracy.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router, fully static output)
- **Database:** Supabase (PostgreSQL) — data fetched at build time, zero per-user DB cost
- **Map:** Mapbox GL JS via react-map-gl
- **Styling:** Tailwind CSS
- **Deployment:** Vercel (free tier)
- **Data scripts:** TypeScript + Playwright (scraping/validation), tsx

---

## Data Sources

| Data | Source |
|------|--------|
| School locations & names | MOE (via sgschooling.com transcription) |
| Phase 2C ballot history | sgschooling.com (cross-validated against MOE) |
| HDB resale transactions | data.gov.sg HDB Resale Flat Prices API |
| Private condo transactions | URA Private Residential Property Transactions API |

---

## Key Learnings (for forks and rebuilds)

### 1. Data credibility is the whole game
The map is only as useful as the ballot data behind it. MOE's official registration results are trapped in a server-side-rendered app with no public API, no CSV export, and no reliable Wayback Machine archive. The practical path: MOE publishes → community site transcribes → you validate. That's two degrees from source. Budget for it.

Before committing to any civic data source, ask:
- Is it machine-readable, or trapped in a UI?
- Is it historically stable, or overwritten each year?
- Is there an independent source to cross-validate against?

### 2. The scoring model is an opinion
`pr_color` looks like a fact. It isn't — it's a model with explicit assumptions baked in. Document them. Users trust transparent tools more, not less.

### 3. Data freshness is a feature
Phase 2C results are published each year around September. This map has no staleness indicator — that's a known gap. A fork should show a `data_last_updated` timestamp and flag when the current year's results aren't loaded yet.

### 4. Property data is the moat
Anyone can build a school map. Pairing Phase 2C odds with avg PSF within 1km of each gate turns a curiosity tool into a decision tool. The HDB and URA datasets are public but require non-trivial geocoding and aggregation — worth preserving if you fork.

### 5. Scraping gotchas
- `page.evaluate()` in Playwright with esbuild/tsx: pass callbacks as raw template literal strings, not function references — esbuild injects `__name()` helpers that crash in browser context
- WhatsApp Android caches OG previews aggressively. Change the image filename or add `?v=N` to bust the cache when updating metadata

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env vars
cp .env.example .env.local
# Fill in NEXT_PUBLIC_MAPBOX_TOKEN and NEXT_PUBLIC_SUPABASE_URL / ANON_KEY

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

```bash
# Validate ballot data against sgschooling.com
npx tsx scripts/validate-ballot-moe.ts

# Apply corrections from discrepancies.csv
npx tsx scripts/apply-ballot-corrections.ts

# Recompute pr_color / pr_label for all schools
npx tsx scripts/compute-scores.ts
```

---

## Forking / Contributing

If you're rebuilding this for a different cohort, country, or school type:
1. Find your equivalent of sgschooling.com — every school system has a community-maintained transcription of official admissions data if you look
2. Define your scoring model explicitly and document the assumptions
3. Pair the school data with housing cost data — that's what makes it a decision tool, not just a map

PRs welcome. Issues welcome. Data corrections especially welcome.
