# Listing logos

Reviewed November 10, 2026. All 200 public listings were checked. **180 listings have verified branding**, supplied by 27 distinct official logos. The remaining 20 display “Logo unavailable.” The second 100-listing expansion has verified school/studio branding for every addition; see [the expansion notes](catalog-expansion-200.md).

On November 16, 2026, the official AccentsOff footer wordmark was verified and added to the existing AccentsOff provider listing. The asset is stored locally at `/logos/independent-accentsoff.png`; it is official business branding, not a portrait. The logo review manifest records this provider separately from the earlier 200-listing audit. The remaining blank-image entries still lack an identifiable official logo in the sources reviewed; portraits and generic site icons were not substituted.

- `data/listing-logos.json` records the official source page, exact image URL, verification date, local asset path, and SHA-256 checksum for each brand.
- `data/logo-review.json` records the outcome for each listing, including the reason for missing imagery.
- `public/logos/` contains downloaded original assets. `scripts/fetch-verified-logos.mjs` and `scripts/fetch-catalog-200-logos.mjs` reproduce the curated downloads and reject non-image responses and active SVG content. Both preserve other reviewed brands.
- `src/listing-logos.js` prefers personal branding, then a recorded school/studio affiliation, or a class’s provider. Source-directory membership alone never supplies a logo.

School branding is explicitly labeled “Studio / school” on coach cards. Profile details name the affiliated institution and link to the official logo source. Lucy Moses School uses the Kaufman Music Center parent logo, identified as such. Logos display their original colors, with light or dark surfaces selected for contrast. Portrait permissions and portrait imagery are separate and unchanged.

“Verified” means the image is identifiable branding published by the coach or organization on its official website. It does not claim endorsement, profile ownership, or a copyright license. No image permission fields were changed.

New York Jazz Academy and 92NY did not serve usable branding pages to HTTP requests or browser checks. Three NYJA faculty members instead have verified personal logos. Other unavailable entries have text-only branding, inaccessible/parked websites, or no identifiable logo in the sources reviewed. Ron Wilkins’s site served an unrelated template logo, which was excluded after visual inspection. Generic hosting favicons, unrelated association logos, Broadway production logos, and portraits are excluded.

Local copies prevent broken third-party hotlinks and avoid sending visitor requests to coach image hosts. The component falls back to the neutral placeholder if an asset fails to load.
