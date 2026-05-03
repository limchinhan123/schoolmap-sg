<div align="center">
  <img src="public/og-v3.jpg" alt="School Hunt for SG PR" width="100%" />

  # SchoolMap SG 🏫🇸🇬

  **A data-driven property & school discovery platform for Singapore Permanent Resident (PR) parents.**

  [![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase)](https://supabase.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
  [![Mapbox](https://img.shields.io/badge/Mapbox-GL_JS-000000?logo=mapbox)](https://www.mapbox.com/)
</div>

---

## 📖 Overview

**SchoolMap SG** is a web application designed specifically to solve a critical, high-stakes problem for Singapore Permanent Residents (PRs): **identifying which primary schools offer a realistic chance of admission, and finding properties within the crucial 1km radius to secure that priority.**

For PR parents, the Primary 1 (P1) registration exercise (specifically Phase 2C) is fiercely competitive. While Singapore Citizens (SCs) receive priority, PRs can still secure spots in certain schools—if they know where to look. This tool synthesizes historical MOE ballot data, school quality indicators, and live property transactions to help parents make informed, data-backed decisions on where to rent or buy.

## ✨ Key Features

- **PR Accessibility Scoring:** Schools are color-coded (Green, Amber, Orange, Grey) based on 3 years of historical Phase 2C ballot data, indicating the real probability of a PR securing a spot.
- **Precision 1km Radius:** Distance calculations use **actual school gate coordinates** (not centroids) via the Haversine formula, perfectly mirroring MOE's official measurement methodology.
- **Integrated Property Data:** View recent HDB resale and private condo transactions within 1km of any school, complete with median PSF calculations and PR-specific ABSD (Additional Buyer's Stamp Duty) estimates.
- **School Quality Metrics:** A 3-star rating system evaluating MOE Autonomous status, special programmes (GEP/SAP/ALP), and secondary school affiliations.
- **Interactive Mapbox Experience:** A dark-themed, highly responsive map interface for spatial discovery, featuring clustering and dynamic pin coloring.

## 🛠️ Tech Stack

This project is built with a modern, performant web stack:

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons
- **Mapping:** Mapbox GL JS, `react-map-gl`
- **Backend & Database:** Supabase (PostgreSQL), RPC functions for geospatial queries
- **Data Ingestion (Scripts):** TypeScript, Playwright (for scraping), OneMap API (Geocoding), URA API, Data.gov.sg

## 📊 Data Sources & Transparency

SchoolMap SG aggregates and synthesizes data from multiple official and community sources:
- **School Information:** Data.gov.sg (General Information of Schools)
- **Geocoding:** OneMap API (Singapore Land Authority)
- **Property Transactions:** Data.gov.sg (HDB Resale) & URA API (Private Residential)
- **Ballot History:** Sourced from community archives (sgschooling.com, SchoolBell.sg) tracking MOE P1 Registration Exercise results.

*Note: Academic performance data (e.g., PSLE scores) is not included, as MOE does not publish school-level results.*

## 🚀 Getting Started

### Prerequisites

To run this project locally, you will need API keys for the following services:
- [Supabase](https://supabase.com/) (Database & Backend)
- [Mapbox](https://www.mapbox.com/) (Map rendering)
- [OneMap SG](https://www.onemap.gov.sg/) (Geocoding - Free)
- [URA API](https://www.ura.gov.sg/maps/api/) (Private property data - Free)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/limchinhan123/schoolmap-sg.git
   cd schoolmap-sg
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or yarn install / pnpm install
   ```

3. **Set up environment variables:**
   Copy the example environment file and add your keys:
   ```bash
   cp .env.example .env.local
   ```
   *Ensure you populate `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_MAPBOX_TOKEN`.*

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🗄️ Database Schema & Logic

The application relies on a robust PostgreSQL schema hosted on Supabase:
- `schools`: Core school data, gate coordinates, computed PR accessibility colors, and quality stars.
- `school_ballot_data`: Historical Phase 2C applicant and vacancy data.
- `hdb_transactions` & `condo_transactions`: Geocoded property sales data spanning the last 16-18 months.

**Scoring Logic:** PR accessibility is computed server-side. For example, a school is marked **Green** if PRs reached the ballot queue in recent years, or **Grey** if SCs within 1km have balloted every year (meaning zero chance for PRs).

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improving the data pipelines, UI enhancements, or bug fixes:
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---
*Built with ❤️ for the Singapore PR community.*
