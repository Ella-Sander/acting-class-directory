# SEO implementation handoff

Implemented locally November 13, 2026. **Not deployed.** The brief explicitly requires separate deployment authorization.

## Results and verification

The full local migration catalog contains 245 directory results (216 teachers and 29 classes), plus 22 published provider profiles. All 267 profiles receive stable crawlable URLs. There are 28 useful landing pages and 345 canonical URLs including pagination. Live database totals may differ; the Worker builds routes and sitemaps from the current published database rather than these snapshot counts.

The automated SEO integration check traverses every sitemap, checks every listed URL returns 200, confirms unique titles and descriptions, canonical equality, one server-rendered H1, robots, OG/Twitter metadata, parseable JSON-LD, and existing internal link targets. A graph traversal confirms all sitemap URLs can be reached from the homepage using ordinary HTML links. It also checks legacy profile redirects, HTTPS, tracking cleanup, pagination, missing/unpublished profiles, publication changes, JSON escaping, noindex filter/admin pages, and exclusion of empty sitemap children. No duplicate sitemap URLs or broken internal targets were found. These are local integration checks, not a claim of Google rich-result eligibility or live indexing.

Validation commands: `npm run build`, `npm run lint`, `npm test`, `npm run test:seo`, `npm run seo:audit`. The lint command validates JavaScript/JSX syntax and merge markers; it is not a full ESLint style configuration. The audit command regenerates [seo-report.json](seo-report.json), including complete counts, eligible landing routes, omitted candidates, and example titles, descriptions, canonicals and schemas.

No browser visual regression or field Core Web Vitals measurements were performed for this SEO implementation. Existing homepage components, musical graphics, colors, filters and modal interactions are retained; new document pages use the same palette. The map loads in a separate JS/CSS chunk. Verify map appearance, modal back navigation, direct profile reloads and narrow-screen layouts in the preview before release.

## Public endpoints after authorized deployment

- Sitemap index: `https://acting-class-directory.ellasanderella.workers.dev/sitemap.xml`
- Children: `/sitemap-coaches.xml`, `/sitemap-studios.xml`, `/sitemap-classes.xml`, `/sitemap-locations.xml`, `/sitemap-specialties.xml`, `/sitemap-pages.xml`. Children are omitted if empty.
- Robots: `https://acting-class-directory.ellasanderella.workers.dev/robots.txt`
- Profiles: `/teachers/{slug}/`, `/providers/{slug}/`, `/classes/{slug}/`.
- City pages: `/new-york/vocal-coaches/`, `/new-york/singing-lessons/`, `/new-york/voice-studios/`, `/new-york/voice-and-speech/`, `/new-york/accent-dialect-coaches/`.
- Online: `/online/vocal-coaches/`.
- Locations and specialties: `/new-york/locations/{slug}/`, `/new-york/specialties/{slug}/`.
- Pagination: canonical `?page=2` etc. Search, filter and sort combinations are crawlable but noindex, follow and canonicalize to their parent route. They are excluded from sitemaps.

Canonical origin is explicitly configured in `wrangler.production.jsonc`; no custom domain was invented. Update that variable and the static robots fallback if a custom domain is connected. Localhost remains usable for preview. The Worker handles all application paths so unrecognized paths return real 404s instead of SPA fallback 200s. Static assets continue through the assets binding. Deployment uses the existing production configuration and database; no migration or database reset is required.

`lastmod` uses the newest actual record update, verification date, or the explicit date this SEO content was authored. It does not advance on requests. Public data reads share a 30-second per-binding cache, invalidated after an editorial decision. HTML and sitemap edge freshness is 30 seconds; updates in another isolate or direct database edits can take up to approximately 60 seconds to appear. Errors, administrative responses, filters and APIs are not publicly cached. Submissions remain pending until the existing approval flow publishes them.

## Deliberate omissions and consolidation

Neighborhood pages require at least three verified singing-related listings and a distinct result set. The machine-readable report lists each data-driven omission and reason. Queens, Astoria, Harlem, Long Island City and Williamsburg do not currently have sufficient verified matching location data for dedicated singing pages. East Williamsburg is kept distinct from Williamsburg. Bronx and some smaller neighborhoods have too few matches. Upper East Side has only two matches. The group-singing specialty duplicates the singing-lessons page and is consolidated into that page.

No beginner/adult/private/Broadway claims were inferred from faculty membership, biographies or a general musical-theatre label. Those audience-specific pages need suitable structured evidence first. Classical/opera uses the existing combined taxonomy instead of creating competing near-duplicate pages. Singing, spoken voice and dialect coaching have separate pages. Unknown or unpublished slugs return 404; existing `?listing=` links redirect permanently to the correct profile. No historical deleted-slug registry exists, so unknown listings use 404 rather than guessing a 410 or redirect target.

The current city namespace allows another city to get separate routes. Before expanding, add a city configuration and verified local inventory; do not reuse NYC location matches for another city.

## Files changed for this SEO task

| File | Purpose |
| --- | --- |
| `src/seo.js` | Shared route catalog, eligibility, canonical paths, HTML content, metadata, truthful schemas, dynamic sitemap index/children, robots and response handling. |
| `src/worker.js` | Integrates SEO handlers; keeps submission/admin APIs; short-lived data cache and editorial invalidation; removes duplicate JSON relation strings and unpublished instructor references. |
| `src/App.jsx` | Crawlable profile and pagination anchors, stable modal URLs, synchronized metadata, direct document pages with existing submission/correction/claim workflows, lazy map import and discovery links. |
| `src/score.css` | Theme-consistent document/exploration styles and reserved map loading space. |
| `wrangler.jsonc`, `wrangler.production.jsonc` | Worker routing for all public pages; explicit production canonical origin. |
| `public/robots.txt` | Absolute sitemap fallback. |
| `public/social-card.svg`, `public/social-card.png` | Original branded share image source and browser/social-compatible PNG. |
| `package.json` | SEO tests, audit and syntax lint commands. |
| `test/seo.test.js` | End-to-end Worker SEO tests against all migrations and rendered pages. |
| `scripts/seo-fixture.mjs` | Isolated in-memory D1-compatible fixture; never touches production data. |
| `scripts/seo-audit.mjs`, `scripts/lint.mjs` | Repeatable audit report and syntax checks. |
| `docs/seo-audit.md`, `docs/seo-report.json`, `docs/seo-handoff.md` | Initial audit, generated evidence and implementation/release instructions. |

## Search Console steps after deployment

No connected Search Console data or account changes were available for this task. The issues above were established from source and local HTTP responses, not from a private Google coverage report.

1. Verify a URL-prefix property for the actual production HTTPS origin. If moving to a custom domain, verify that property and update the canonical configuration first.
2. Open the sitemap index on the deployed site, then submit `/sitemap.xml` in Search Console. Child sitemaps are discovered through the index.
3. Inspect the homepage, one teacher, one class, a location and a specialty page. Run the live URL test; confirm rendered HTML, indexing permission and declared canonical. Request indexing for a small representative set.
4. Review Page indexing for old `?listing=` URLs (expected redirects), filter/search URLs (expected noindex or canonical consolidation), and removed records (expected 404). Only validate fixes after the corresponding live response is correct.
5. Check the public Rich Results Test and Schema Markup Validator on representative profiles. Valid schema does not guarantee a rich result; Person and generic directory pages may have no supported rich-result type.
6. Monitor sitemap processing, Google-selected canonicals, impressions/queries and field Core Web Vitals after recrawling. No implementation can guarantee indexing, rankings or a specific recrawl date.

Reference: [Google JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), and [sitemap indexes](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps).
