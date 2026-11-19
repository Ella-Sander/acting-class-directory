# Vocal Catalog production launch

Launched November 14, 2026, to **https://vocalcatalog.com**.

Deployment succeeded: `ad2cb23e-dd42-4454-9bba-311aa357e13a` on the existing `acting-class-directory` Worker. Both `vocalcatalog.com` and `www.vocalcatalog.com` are enabled Worker Custom Domains. The existing D1 binding and database ID are unchanged. No production migrations, resets, imports, submission tests or data writes were performed.

## Verified live

| Check | Result |
| --- | --- |
| HTTPS apex and www | Valid TLS connections; apex serves the site; www redirects to apex. |
| Production APIs and D1 | `/api/health` returns healthy/configured; `/api/directory` returns the full directory. |
| Data preservation | Exact SHA-256 match of the complete public API payload before and after deployment: `8484d373909ca70af97204d2f83f9a6fc58a39c3e156890b96e0279ed144a99b`. |
| Directory results | 245: 216 individual teachers and 29 classes/programs. |
| Indexable profile pages | 267: the above 245 plus 22 published school/studio/provider profiles. |
| Landing pages | 28 useful city, location, online and specialty pages. Unsupported audience or location pages are not fabricated. |
| Total sitemap URLs | 345, including canonical pagination. Every URL fetched live with HTTP 200. |
| Metadata | All sitemap pages have unique titles/descriptions, the correct canonical origin, one server-visible H1, indexing permission and parseable structured data. Exact requested homepage copy verified. No obsolete Voxline branding in rendered sitemap pages. |
| Internal discovery | All sitemap URLs reachable from homepage HTML links; no duplicate sitemap URLs, orphaned pages or invalid internal targets found. |
| Images | All 41 distinct listing logos returned image content successfully; favicon, social PNG and app manifest returned 200. |
| Robots and error behavior | Absolute production sitemap reference; search/filter/admin pages remain crawlable with noindex; missing profiles and out-of-range pages return 404. |
| Browser checks | Desktop 1440×900, laptop 1366×768, mobile 390×844 and 320×740. No page/header overflow, broken visible images, uncaught JS exceptions or resource errors in the test runs. Desktop counts remain in the opening viewport. |
| Directory interactions | Search, category selection, pagination, stable profile modal URL, modal back navigation retaining page 2, direct profile reload, empty-state display and reset all passed on the live site. |
| Worker logs | Five sampled requests had `ok` outcomes; no exceptions/error logs during that sample. Raw headers and request logs were not persisted. |
| Local checks | Production build, syntax/merge-marker lint, and all 31 Node tests passed. Includes complete sitemap integration validation and transactional submission/approval tests in an isolated in-memory database. |

Evidence: [live HTTP checks](launch-live-checks.json), [production browser checks](launch-browser-production.json), [local browser checks](launch-browser-local.json), [log sample](launch-log-check.json), [Cloudflare domain/binding audit](cloudflare-launch-audit.json), [predeployment data baseline](launch-baseline.json), and [catalog/metadata/schema examples](seo-report.json). Browser screenshots are under `artifacts/launch-production-*.png`.

## Redirects

All four sources below returned **308** directly to `https://vocalcatalog.com/teachers/abby-payne-voice-teacher/?ref=launch`, preserving the path and meaningful query:

- `http://vocalcatalog.com/teachers/abby-payne-voice-teacher/?ref=launch`
- `http://www.vocalcatalog.com/teachers/abby-payne-voice-teacher/?ref=launch`
- `https://www.vocalcatalog.com/teachers/abby-payne-voice-teacher/?ref=launch`
- `https://acting-class-directory.ellasanderella.workers.dev/teachers/abby-payne-voice-teacher/?ref=launch`

Legacy `?listing={slug}` URLs permanently redirect to the corresponding stable profile. Existing directory aliases still work. Tracking cleanup and slash normalization remain centralized. Unit tests verify unrelated Worker preview hosts and localhost are not redirected; unrelated preview responses use noindex and production canonicals. Preview URLs remain disabled in the production configuration.

## Sitemaps and robots

- [Sitemap index](https://vocalcatalog.com/sitemap.xml)
- [Coaches](https://vocalcatalog.com/sitemap-coaches.xml): 216
- [Studios/providers](https://vocalcatalog.com/sitemap-studios.xml): 22
- [Classes](https://vocalcatalog.com/sitemap-classes.xml): 29
- [Locations](https://vocalcatalog.com/sitemap-locations.xml): 20, including pagination
- [Specialties](https://vocalcatalog.com/sitemap-specialties.xml): 26, including pagination
- [Other pages](https://vocalcatalog.com/sitemap-pages.xml): 32, including pagination
- [robots.txt](https://vocalcatalog.com/robots.txt)

Sitemaps and public document routes use the same published-record catalog. Approval invalidates the short data cache; unpublished/deleted records fall out automatically. Empty sitemap children are omitted. Real record/verification dates and the explicit SEO edit date drive lastmod. Search, filter, sort, redirect and error URLs are excluded. The previous public cache policy remains short-lived; cross-isolate and edge freshness can take approximately 60 seconds after a change.

## Changes made for this launch

| Files | Purpose |
| --- | --- |
| `src/brand.js` (new) | Single source for brand, exact homepage copy, pagination metadata, canonical/legacy/preview host policy. |
| `src/App.jsx` | Vocal Catalog header/footer/admin wording, exact H1/subtitle, consistent metadata on filters/pagination/modal navigation, functional class correction requests, and retryable submission errors. |
| `src/seo.js` | New brand across server metadata and JSON-LD; exact homepage copy; production canonicals; no forced redirects or indexing of unrelated previews; app manifest handling. Existing selective landing eligibility and truthful schemas retained. |
| `src/worker.js` | Domain policy also covers APIs and legacy routes. Fixed teacher submissions against the legacy D1 queue enum without a database migration: store in its existing provider category, retain validated teacher type in payload, and resolve it in review/approval. Fixed nameless profile correction validation and added corrections for class records. |
| `src/NeighborhoodMap.jsx` | Map popup links point directly to stable profile paths. Existing appearance and pin behavior retained. |
| `src/score.css` | Small 320px header adjustment for the longer brand; music theme and map layout retained. |
| `index.html` | Updated fallback title/description, branded favicon cache key and manifest link. |
| `public/favicon.svg`, `public/social-card.svg`, `public/social-card.png`, `public/site.webmanifest`, `public/robots.txt` | Brand and share assets, manifest and production sitemap reference. |
| `wrangler.production.jsonc` | Explicit apex/www Custom Domains and production canonical variable; existing resources and secret bindings preserved. |
| `wrangler.jsonc` | Local application route list allows Vite to handle development module requests correctly. |
| `test/launch.test.js`, `test/seo.test.js`, `scripts/seo-fixture.mjs` | Host/branding/preview checks, date-aware SEO assertion, transactional D1 fixture, and actual SQL binding tests for submission, approval, claims and corrections. |
| `scripts/check-live-launch.mjs`, `scripts/check-launch-browser.mjs`, `scripts/check-launch-logs.mjs`, `scripts/cloudflare-launch-audit.mjs` | Repeatable live HTTP, browser, log and account audits. Live checks only read public data. Credentials and raw tail events are never written to reports. |
| `scripts/seo-audit.mjs`, `scripts/check-deployed-hero.mjs` | Updated audit and existing visual-check targets to the new production origin. |
| `README.md`, `docs/seo-report.json`, this report and linked evidence | Current deployment instructions and reproducible launch evidence. Earlier dated SEO reports remain historical. |

No public-facing design rewrite, framework migration or new package dependency was introduced. Internal Worker/D1 identifiers and historical listing/research data were preserved. Leaflet stays in a separate JS/CSS chunk, logos remain lazy-loaded with reserved dimensions, and system font stacks avoid additional font requests. Field Core Web Vitals were not available; no claim of a field CWV pass is made.

## Google accounts and remaining manual steps

**Search Console status: not connected to this session.** Live pages have no verification meta tag, but DNS-based verification may exist; the current credentials cannot inspect DNS TXT records. Search Console ownership, sitemap submission and Google indexing have not been confirmed. No GA4 or Cloudflare Web Analytics beacon was detected in delivered HTML, and no tracking ID was invented or installed.

1. In Google Search Console, select an existing property or add a **Domain** property for `vocalcatalog.com`. If ownership is not already verified, use Google's Cloudflare authorization flow or add the exact TXT record Google supplies in Cloudflare → vocalcatalog.com → DNS → Records. Preserve existing DNS records. Complete verification in Search Console.
2. In that property, open **Sitemaps** and submit `https://vocalcatalog.com/sitemap.xml`. Child files are discovered through the index.
3. Inspect the homepage, one teacher, a class, a location and a specialty URL using **Test live URL**. Confirm crawling/indexing permission and declared canonical. Request indexing for a few representative pages, then monitor processing and Google-selected canonicals.
4. If the old public host has a verified Search Console property, submit the new sitemap and use the applicable site-move tools for the domain migration. Redirects are already live; do not remove them after initial launch.
5. If analytics is desired, provide/connect the actual GA4 measurement ID or enable Cloudflare Web Analytics in the account. Keep a single integration to avoid duplicate events. No analytics setup is necessary for the site to function or be crawled.

**No domain action remains necessary for basic operation:** both hostnames resolve through their enabled Custom Domains and HTTPS worked in live requests. Direct DNS-record and certificate-inventory API access returned 403 under this login; DNS record types, certificate inventory/expiry and zone-wide TLS settings were not independently audited. This did not block Custom Domain deployment or verified HTTPS delivery. Cloudflare manages DNS/certificates for [Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

The checks validated application routes, local images and public data. They did not exhaustively request every third-party coach website, guarantee external-site availability, run Google's private account tools or guarantee indexing/rankings. Missing sourced prices, private lesson availability, credentials and location data remain explicitly unknown rather than being invented for search keywords.
