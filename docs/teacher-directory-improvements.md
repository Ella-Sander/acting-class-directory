Production update: Deployed with the validated institutional discovery release, version 9cf9d41e-be58-435f-a1c9-5738e3bebef8. Migration 0014 is now applied to production. The local-only/deployment-pending statements below describe the earlier implementation stage; see [current release notes](institutional-discovery.md).

﻿# Teacher facts, ownership requests, saved listings, lesson filters and centered header

Implemented and validated locally November 15, 2026. Production has not been changed by this task.

## Behavior and verified data

Teacher type and current availability are independent fields. Only sourced, verified explicit type evidence supports Independent; verified institutional affiliation supports Institutional. Missing or uncertain information stays unconfirmed. Availability additionally requires dated evidence from the last 30 days. Booking links require their own verified evidence. Official links use Visit Website or View Faculty Profile and retain external-link security attributes.

The local complete catalog contains 216 teachers, 29 programs and 22 organizations. Existing evidence supports 113 Institutional labels; 103 teacher types remain unconfirmed. All 216 current availabilities remain unconfirmed. No Independent classification, private lesson offer or new-student availability was invented. There are currently 28 directory entries with supported group instruction, including teachers linked to documented group programs. There are no source-verified private-format entries in the current dataset; those filters intentionally show an empty state until reliable evidence is recorded. Both-format entries are supported and regression-tested.

Every teacher has Claim or Remove Listing in the dialog and standalone profile. The public form needs contact information and ownership verification details, but no account. It creates a private pending request in the existing submission queue and uses the existing support-email notification flow. An authenticated editor must confirm ownership through an official contact channel and record at least 20 characters describing verification before approval. Approval is audited. Removal archives the teacher and invalidates public caches; it never deletes teacher or relationship records. Claims never automatically grant credentials or public editing access. A self-service owner editing portal has not been added.

Save buttons store typed listing IDs (`teacher:id`, `offering:id`, `provider:id`) under `vocal-catalog:saved-listings:v2` in localStorage. Saved listings work with search, categories, filters, sorting and pagination. Missing/unpublished records are omitted with explanatory text; Clear saved also clears unavailable IDs. Browser storage failures fall back to the current visit with an explanation. Saved choices do not enter D1 or shared caches.

Lesson Format is prominent in the sidebar and directly accessible above directory results on mobile. Attendance remains separate. The centered Vocal Catalog masthead uses equal-width outside grid columns; the NYC logo, navigation and menu do not shift the title. Mobile navigation includes Get listed.

## Files

- `src/App.jsx`, `src/score.css`: labels, official links, request forms, ownership approval UI, lesson filter, saved views, responsive centered masthead.
- `src/teacher-facts.js`: pure evidence rules shared by client and server.
- `src/directory-data.js`, `src/directory-utils.js`: facts included in the existing three bulk queries and targeted profile query; compatible lesson filtering. Existing evidence/relationship indexes serve the added lookups; no per-card database queries.
- `src/worker.js`: private removal submissions, ownership approval checks, archival and audit record; reuses existing admin authorization and cache invalidation.
- `src/seo.js`: consistent server-rendered facts and official links; existing metadata, canonical URLs, sitemap and schema retained; saved collection remains noindex/no-store.
- `src/saved-listings.js`, `src/SavedListings.jsx`: local typed-ID persistence and bookmark controls.
- `src/public-cache.js`, `src/browser-directory-cache.js`: schema/storage version bumps prevent older cached payloads from omitting new facts.
- `migrations/0014_teacher_facts.sql`: three nullable instructor fields and sourced group-format evidence derived from the existing verified Group Singing Classes taxonomy. No tables or existing listing records are deleted or rebuilt.
- Tests: `test/teacher-facts.test.js`, `test/saved-listings.test.js`, `test/launch.test.js`, `test/public-cache.test.js`, `test/voice-speech.test.js`.
- Browser checks: `scripts/check-teacher-improvements.mjs`, `scripts/check-saved-listings.mjs`, existing launch/browser-cache checkers updated for current controls/storage.

## Validation

- `npm.cmd test`: 55 passing tests, including every sitemap URL/SEO output, filtered routes, cache hits with zero D1 queries, targeted profile requests, submissions/approval, ownership enforcement, removal archival/cache invalidation, saved storage and migration preservation.
- `npm.cmd run lint`: syntax/merge-marker checks pass. There is no separate TypeScript/type-check command in this JavaScript repository.
- `npm.cmd run build`: production client and Worker build pass.
- Local Chromium: masthead centering and no overflow at 1440, 1200, 768, 390 and 320 pixels; mobile lesson filters, group/private/reset behavior and no-account removal form pass. General launch checks additionally cover desktop/mobile, pagination, canonical URLs, modal/direct profiles, category/search and empty/reset states. Saved checks cover reload persistence, count/view, saving schools, filtering, modal unsave and direct-profile save. No uncaught exceptions.
- Evidence: `docs/teacher-improvements-browser-check.json`, `docs/launch-browser-teacher-improvements.json`, `docs/saved-listings-browser-check.json`, `docs/teacher-facts-local-audit.json`; screenshots under `artifacts/launch-teacher-improvements-*.png`.
- Local query-plan audit: the existing three-query directory and single-query targeted profile strategy remains; evidence lookups use existing entity indexes. Sample local SQLite durations were about 1.00ms providers, 0.73ms offerings and 5.10ms teachers. These are local timing samples, **not production D1 row-read measurements**. Production D1 reads were not exercised for this feature task.

## Migration / later production release

Migration 0014 has been applied only to local D1 and test fixtures. Once production deployment is authorized, inspect pending migrations, back up the database, apply the additive migration, build and deploy with the existing production configuration:

```powershell
npx.cmd wrangler d1 migrations list acting-class-directory --remote --config wrangler.production.jsonc
npx.cmd wrangler d1 export acting-class-directory --remote --config wrangler.production.jsonc --output artifacts/before-teacher-facts-production.sql
npx.cmd wrangler d1 migrations apply acting-class-directory --remote --config wrangler.production.jsonc
npm.cmd run build
npx.cmd wrangler deploy --config wrangler.production.jsonc
```

Review the pending list before applying: production should already have migrations through 0013, leaving only 0014. The cache schema becomes directory-v3 and the public browser cache key becomes v2, refreshing old data automatically. Existing KV and D1 bindings are reused; no service upgrade is needed. Then repeat the public browser and cache smoke checks against the live domain. No production migration, email submission, or deployment was performed for this task.
