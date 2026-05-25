<div align="center">
  <img src="public/og-v3.jpg" alt="School Hunt for SG PR" width="100%" />

  # School Hunt for SG PR 🏫🇸🇬

  **Which primary school got chance to enter ah?**

  [![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase)](https://supabase.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
  [![Mapbox](https://img.shields.io/badge/Mapbox-GL_JS-000000?logo=mapbox)](https://www.mapbox.com/)
</div>

---

A map and list tool for Singapore Permanent Residents navigating the P1 registration process. See Phase 2C ballot history for every primary school, filter by PR accessibility, and cross-reference nearby property prices — before you sign the lease.

🔗 **Live:** [schoolmap-sg.vercel.app/?v=1](https://schoolmap-sg.vercel.app/?v=1)

---

## What It Does

- **Map view** — colour-coded pins showing each school's PR accessibility, with Mapbox clustering at lower zoom levels
- **List view** — sortable table with school name, region, PR access tier, quality stars, programmes (GEP / SAP / ALP / IP), and avg PSF within 1km
- **Filters** — multi-select PR access, region, quality tier, programmes, property zone; search by name; reset all
- **School detail panel** — Phase 2C ballot history by year, nearby HDB and condo transactions, affiliated secondary school

---

## PR Access Scoring

Each school is scored from Phase 2C ballot data (2022–2024):

| Colour | Label | Meaning |
|--------|-------|---------|
| 🟢 Green | Open / Vacancies Remained | PRs have reached Phase 2C ballot, or vacancies remained for 2+ consecutive years |
| 🟡 Amber | Possible / Recently Cleared | Demand softening — a window may be opening |
| 🟠 Orange | Marginal | Patchy history — occasional chance, not reliable |
| 🟣 Purple | Closed | Oversubscribed by SCs — no realistic PR window |
| ⚪ Grey | Emerging | New school or limited data |

> **Transparency note:** Scoring is a model, not ground truth. The thresholds are deliberate judgment calls. Phase 2C ballot data validated against sgschooling.com. MOE historical data has no public API.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router, fully static output)
- **Database:** Supabase (PostgreSQL) — data fetched at build time, zero per-user DB cost
- **Map:** Mapbox GL JS via react-map-gl
- **Styling:** Tailwind CSS
- **Deployment:** Vercel (free tier)
- **Data scripts:** TypeScript + Playwright, tsx

---

## Data Sources

| Data | Source |
|------|--------|
| School locations & names | MOE via Data.gov.sg + OneMap API |
| Phase 2C ballot history | sgschooling.com (cross-validated against MOE) |
| HDB resale transactions | data.gov.sg HDB Resale Flat Prices API |
| Private condo transactions | URA Private Residential Property Transactions API |

---

## Local Development

```bash
git clone https://github.com/limchinhan123/schoolmap-sg.git
cd schoolmap-sg
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_MAPBOX_TOKEN, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

---

## Scripts

```bash
npx tsx scripts/validate-ballot-moe.ts      # validate ballot data vs sgschooling.com
npx tsx scripts/apply-ballot-corrections.ts # apply corrections from discrepancies.csv
npx tsx scripts/compute-scores.ts           # recompute pr_color / pr_label for all schools
```

---

## Key Learnings (for forks and rebuilds)

### 1. Data credibility is the whole game

The map is only as useful as the ballot data behind it. MOE's official results are trapped in a server-side-rendered app — no public API, no CSV, no Wayback Machine archive. The practical path: MOE publishes → community site transcribes → you validate. That's two degrees from source.

Before committing to any civic data source, ask:
- Is it machine-readable, or trapped in a UI?
- Is it historically stable, or overwritten each year?
- Is there an independent source to cross-validate against?

### 2. The scoring model is an opinion

`pr_color` looks like a fact. It isn't — it's a model with explicit assumptions baked in. Document them. Users trust transparent tools more, not less.

### 3. Data freshness is a feature

Phase 2C results publish each September. This map has no staleness indicator — that's a known gap. A fork should show `data_last_updated` and flag when the current year's results aren't loaded.

### 4. Property data is the moat

Anyone can build a school map. Pairing Phase 2C odds with avg PSF within 1km turns a curiosity tool into a decision tool. The HDB and URA datasets are public but require non-trivial geocoding and aggregation — preserve this if you fork.

### 5. Scraping gotchas

- `page.evaluate()` in Playwright with esbuild/tsx: pass callbacks as template literal strings, not function references — esbuild injects `__name()` helpers that crash in browser context
- WhatsApp Android caches OG previews aggressively. Rename the image or add `?v=N` to the share URL to bust the cache

---

## Contributing

If you're rebuilding this for a different cohort, country, or school type:
1. Find your sgschooling.com equivalent — every school system has a community transcription of official admissions data
2. Define your scoring model explicitly and document the assumptions
3. Pair school data with housing cost data — that's what makes it a decision tool, not just a map

PRs welcome. Issues welcome. Data corrections especially welcome.

---

*Built for the Singapore PR community. Some schools are never meant for PR — now you'll know which ones.*
