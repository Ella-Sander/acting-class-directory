# SEO audit and implementation plan

Audited November 13, 2026, before implementation.

## Existing architecture and findings

- React/Vite frontend, a Cloudflare Worker serving `dist/client`, and a dedicated D1 database. Published records are already queried separately from submissions and archives. Existing metadata, sitemap, robots and profile handlers should be replaced in place rather than adding a framework.
- Homepage HTML has an empty React root. Profile handlers inject a title, description, canonical and JSON-LD, but no listing content. Profiles therefore depend on JavaScript and a second API request for all meaningful content.
- Sitemap contains homepage and modal query URLs; no sitemap index, provider profiles, locations, specialties, pagination or real modification dates. Coach canonical URLs also point back to modal queries.
- Unknown paths fall through to SPA HTML, allowing soft 404s. HTTPS/preferred-host/trailing-slash rules are not centralized. Administrative pages receive their noindex only after React runs.
- Listing cards and page controls use buttons, so ordinary crawler-visible profile/pagination links are missing. Category and neighborhood refinements are client-only.
- Existing verified taxonomy distinguishes singing, spoken voice, and dialect work. Several requested locations and audience/experience keywords are unsupported; inventing pages for them would create empty or misleading landing pages.
- Metadata lacks a shared source of truth: client effects can replace server canonicals. Twitter and image metadata are missing. LocalBusiness eligibility, breadcrumbs and listing collections need deliberate schema handling.
- Database queries return JSON relation strings as well as parsed relations, duplicating API payload. Public reads can share a short-lived database cache, invalidated after writes. Images are already lazy-loaded and logos locally served. Leaflet can be split from the main bundle without changing its appearance.
- No existing lint command, SEO integration test, or Search Console connection. No field Core Web Vitals or private Google coverage data is available; repository findings must not be represented as Search Console observations.

## Implementation boundaries

Use stable `/teachers/`, `/providers/`, and `/classes/` profile URLs, a city-scoped curated landing-page registry derived from verified records, real HTML for every indexable route, and sitemap subsets built from the same route registry. Give every visitor the same server HTML; React progressively replaces the homepage fallback and enhances dedicated SEO pages. New public pages use the current palette and components; existing homepage design, modal interactions, filters and editorial workflows remain intact.

Keep low-value search/filter combinations noindex and crawlable. Consolidate tracking and alias URLs; paginate with canonical HTML links. Use truthful schemas and actual database/content modification dates. Do not add external services, medical claims, fabricated review data, or unsupported neighborhood pages.

Authorization: this SEO brief requires deployment authorization. Implementation and local checks are authorized; the SEO changes will not be deployed as part of this task without a further explicit instruction.
