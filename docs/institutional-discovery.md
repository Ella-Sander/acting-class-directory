# Institutional teacher discovery

Implemented and deployed November 15, 2026 (November 16 UTC). Production version: 9cf9d41e-be58-435f-a1c9-5738e3bebef8. No external scraping, listing deletions or URL changes were performed.

## Behavior

- Teacher affiliation labels are Independent, Institutional, or Affiliation unconfirmed. A teacher can match both Independent and Institutional, and display multiple sourced institution names.
- Institutional classification requires an existing institution relationship plus dated, verified same-domain affiliation evidence. An existing verified profile record explicitly marked as an official voice-faculty/studio roster also supports that relationship. A faculty-looking URL or a professional biography alone does not establish affiliation, private instruction, formats or availability.
- Teacher profiles remain distinct from associated classes/programs. Cards show name, specialties, verified institutions, documented offering formats, availability and secure official links. Faculty, website and class links use View Faculty Profile, Visit Website and Explore Classes. No unverified booking action is shown.
- Independent Teacher Type and Lesson Format controls compose with existing category, search, location, specialty, sorting, pagination and saved views. Formats support Private / One-on-One, Group Classes, Workshops and the displayed unknown state Format unconfirmed. Selecting a teacher type filters teacher profiles, rather than assigning institutions' standalone class listings a teacher identity.
- Workshop evidence uses the existing field_evidence key lesson_format_workshop or the existing verified Workshops and Intensives taxonomy relation. Private/group can also use their own lesson_format_private/group evidence. Multiple formats do not require widening a database enum. Direct format evidence and associated offering evidence are shown as documented offerings, without suggesting current enrollment.
- Homepage copy now reads: “Discover NYC voice teachers, private lessons, and group classes.” Additional copy includes independent teachers and institutional faculty. The supplied discovery disclaimer appears in the directory and profile views, including server-rendered content.
- Existing Claim or Remove Listing and authenticated ownership-review workflow is retained. Its request selector additionally offers a correction request. Requests require no website account, remain pending for admin review, and never grant editing credentials automatically.

## Stored-source audit

Reproduce with `node scripts/audit-institutional-listings.mjs`. Full per-teacher sources, verified institutions, missing facts, faculty-URL candidates and query plans are in `docs/institutional-listing-audit.json`.

All 216 published teachers, 29 programs and 22 organizations remain. Verified stored affiliation/roster evidence supports 167 Institutional classifications; 49 affiliations remain unconfirmed. Of these 167, 54 were previously left unconfirmed even though the stored verified profile note explicitly identified an official roster. There are 82 faculty-URL candidates; the URL pattern is an audit hint, not classification evidence.

No current Independent classification is supported by explicit stored evidence. No published private-format or workshop offering is source-verified. The single stored workshop-taxonomy match is an unpublished offering and remains unpublished. Empty filters are intentional, not missing listings. Current availability remains unconfirmed for all 216 teachers. Group formats are supported only where sourced; 10 institutional teachers have documented linked group offerings.

Manual verification still needed: the 49 uncertain affiliations; independent work alongside faculty roles; private/workshop offerings and their specific source URLs; current enrollment availability; and ongoing freshness of existing stored sources. Existing sources were audited in the repository, not fetched/revalidated live.

## Files and schema

- `src/teacher-facts.js`: multiple affiliations/types, workshop/multiple-format evidence rules, safe link labels and unknown states.
- `src/directory-data.js`: returns explicit roster metadata and workshop evidence within the existing three bulk queries / one targeted profile query. No per-card requests or N+1 D1 queries. Existing entity/relationship indexes serve the added lookups.
- `src/directory-utils.js`: independent teacher-type filter alongside lesson formats.
- `src/App.jsx`, `src/score.css`: cards, filters, messaging, responsive controls, correction selector and official/class links.
- `src/brand.js`, `src/seo.js`: consistent public/server-rendered messaging and facts; canonical URLs, sitemap and structured data remain functional.
- `src/public-cache.js`, `src/browser-directory-cache.js`: version shared/local payloads to include the new evidence fields.
- `test/institutional-discovery.test.js`, `test/public-cache.test.js`: multi-affiliation, formats, unknowns, roster-source checks, filtered pagination, SEO, targeted query parity and cache coverage.
- `scripts/audit-institutional-listings.mjs`, `scripts/check-institutional-discovery.mjs`, `scripts/check-browser-directory-cache.mjs`: reproducible source audit and browser/cache validation.

No new migration is required for this task; existing evidence, relationship and taxonomy structures support the changes. The prior task's additive `0014_teacher_facts.sql` remains a prerequisite for the cumulative production release and has only been applied locally.

## Validation

- `npm.cmd test`: 59 tests pass, including migration preservation, every existing sitemap URL, canonical/structured-data checks, cached requests with zero D1 queries, targeted profile requests, claim/removal authorization and archive behavior, saved storage, and new institutional-discovery tests.
- `npm.cmd run lint` and `npm.cmd run build`: pass. This JavaScript project has no separate type-check command.
- Local Chromium: 320, 390, 768, 1200 and 1440px layouts show centered header, visible mobile controls, no horizontal overflow or title/menu overlap. Institutional cards show institution names and safe links; pagination, combined filters, search, independent/workshop unknown states, reset, standalone profiles and no-account ownership forms pass without uncaught exceptions.
- Saved-listing browser checks cover persistence across reloads, filtering, school/profile saves and modal removal.
- Evidence: `docs/institutional-discovery-browser-check.json`, `docs/saved-listings-browser-check.json`; screenshots `artifacts/institutional-discovery-1440.png` and `artifacts/institutional-discovery-390.png`.
- Query plans/durations in the source-audit JSON are local SQLite measurements, not production D1 row-read measurements. Production was not queried for this task.

For a later authorized release, use the existing production Wrangler configuration after reviewing/applying the prior pending migration, then repeat public smoke checks. Production deployment has not been attempted by this task.
## Changed files

- `src/teacher-facts.js`: multiple verified affiliation types/institutions, workshop and per-teacher format evidence, unknown labels and official link wording.
- `src/directory-data.js`: public roster-evidence metadata and indexed workshop/taxonomy lookups inside existing bulk/targeted queries.
- `src/directory-utils.js`: independent teacher-type filtering combined with sourced format filters.
- `src/App.jsx`, `src/score.css`: cards, responsive filters, evidence/offerings labels, secure card links, correction request choice, discovery copy and dark-card contrast.
- `src/brand.js`, `src/seo.js`: inclusive homepage/discovery wording and consistent server-rendered cards/profiles/filtered routes.
- `src/public-cache.js`, `src/browser-directory-cache.js`: cache contract/version updates.
- `test/institutional-discovery.test.js`, `test/public-cache.test.js`: focused regression coverage and original-field preservation checks that allow added metadata.
- `scripts/audit-institutional-listings.mjs`, `scripts/check-institutional-discovery.mjs`, `scripts/check-browser-directory-cache.mjs`: reproducible local audit/browser evidence and storage-key update.
- `docs/institutional-listing-audit.json`, `docs/institutional-discovery-browser-check.json`, `artifacts/institutional-discovery-1440.png`, `artifacts/institutional-discovery-390.png`: audit and visual evidence.

## Migrations and release status

No additional migration is needed for this task. It reuses the existing affiliation relationships, offering relationships, nullable teacher facts and field_evidence/taxonomy tables. The preceding task's additive `0014_teacher_facts.sql` was backed up and applied to production before the cumulative release.

## Production release verification

Version 9cf9d41e-be58-435f-a1c9-5738e3bebef8 is live on https://vocalcatalog.com. Production D1 was exported to the ignored local .wrangler directory before migration 0014 was applied successfully. Existing email, D1, public KV, asset and version bindings were retained.

Public live browser checks passed at 320?1440px: institution names, secure official links, filters/search/reset, pagination, direct profiles, no-account request forms and saved-listing persistence/removal. No uncaught browser exceptions were observed. No live request form was submitted and no approval/removal test changed production listings. Directory counts remain 216 teachers, 29 programs and 22 organizations. Public homepage, directory/profile APIs, HTML profiles, filtered pages and sitemap requests passed; repeated requests reported zero D1 queries and zero rows read.

Evidence: docs/institutional-discovery-production-browser-check.json, docs/saved-listings-production-browser-check.json and docs/d1-live-cache.json. Production screenshots: artifacts/institutional-discovery-production-1440.png and artifacts/institutional-discovery-production-390.png.
