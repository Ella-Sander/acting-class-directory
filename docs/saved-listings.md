Production update: Deployed with the validated institutional discovery release, version 9cf9d41e-be58-435f-a1c9-5738e3bebef8. Migration 0014 is now applied to production. The local-only/deployment-pending statements below describe the earlier implementation stage; see [current release notes](institutional-discovery.md).

# Saved listings

Implemented and tested locally November 15, 2026. **Not deployed:** automatic approval review rejected the production deploy because this feature request did not explicitly authorize publishing. Deployment requires the user's approval.

Visitors can bookmark teachers, classes and schools with the burgundy bookmark control on directory cards, profile dialogs and standalone profile pages. A Saved navigation link and All listings / Saved listings controls make the collection accessible. Existing filters, categories, sorting, pagination and piano display remain available; saved providers can appear in the saved collection without adding them to the default teacher/class directory.

Only typed listing IDs persist under `vocal-catalog:saved-listings:v2` in the visitor's localStorage. Preferences are not sent to D1 or embedded in shared server caches. Saved choices survive reloads and synchronize across tabs. Unpublished/unavailable records are not displayed; visitors can remove individual bookmarks or clear the collection. When storage is blocked, choices work for the current visit with a visible explanation in Saved view. No account is required, and clearing browser data clears the saved choices.

The `?saved=1` route is no-store and noindex, canonicalized to the main directory. It contains no personalized server-side ItemList or saved identifiers. Its generic no-JavaScript message explains that saved choices live in the browser. Private pagination does not incorrectly return a public-directory out-of-range 404.

Verification: lint, production build and all 51 Node tests passed. Local browser checks passed save without opening a profile, reload persistence, Saved filtering, removal within a modal, direct-profile saving, empty state, school saving/opening and mobile overflow checks. No uncaught browser exceptions were observed. [Browser evidence](saved-listings-browser-check.json).

Main files: `src/saved-listings.js`, `src/SavedListings.jsx`, `src/App.jsx`, `src/score.css`, `src/seo.js`, `test/saved-listings.test.js`, `scripts/check-saved-listings.mjs`. The existing general browser checker was updated to use the explicit profile anchor inside the card. Cards use sibling profile links and bookmark buttons, avoiding nested interactive controls.

Local review screenshots: `artifacts/saved-listings-local-desktop.png` and `artifacts/saved-listings-local-mobile.png`. After deployment approval, rebuild and deploy with the existing production Wrangler configuration; no migration or production data change is required.

The later teacher-directory task retains this feature and adds an additive teacher-facts migration. See [current implementation and release notes](teacher-directory-improvements.md).
