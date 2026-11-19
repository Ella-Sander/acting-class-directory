# Browser directory cache

Deployed November 15, 2026. Worker version: `9d8590d0-ac3b-4c0e-99f2-3120509cd0c0`.

The public directory now persists in same-origin localStorage under `vocal-catalog:public-directory:v1`. A repeat visit displays those listings immediately and skips `/api/directory` while the snapshot is less than five minutes old. An expired snapshot refreshes while the saved directory remains visible. Visible pages check freshness once a minute; returning to a visible tab checks it too, and restored connectivity forces a refresh.

The server embeds its public-cache revision in the page and returns it in `X-Directory-Version`. A new page with a different publication revision rejects the older browser snapshot. Server stale fallbacks never reset the browser snapshot's timestamp. This adds browser caching to the existing shared KV/Cache API layers; it does not replace server-side caching.

Only the three published public collections are persisted. Search history, submissions, claims, admin responses and contact payloads are not cached. Admin pages do not create the public-data loader or fetch the directory. Disabled/full storage, invalid JSON, revision mismatches and invalid/private payload shapes fall back to normal loading.

If a refresh fails, a valid saved snapshot may be used for up to 24 hours with an explicit availability notice. Without a usable snapshot, the existing error state remains. This is directory-data resilience while the application is loaded, not a service worker or a guarantee that a completely offline initial page can open.

Verification: production build and lint passed; all 48 automated tests passed. The live headless-browser check recorded one API request on the first visit, **zero on a fresh repeat visit**, one after expiry, continued listings during a simulated network failure, successful recovery, matching cache revisions and zero directory requests on the admin page. See [live browser evidence](browser-directory-cache-check.json).

Files: `src/browser-directory-cache.js`, `src/App.jsx`, `src/public-cache.js`, `src/worker.js`, `src/seo.js`, `test/browser-directory-cache.test.js`, `scripts/check-browser-directory-cache.mjs`, this report and the generated check JSON. Existing styling, listing data, filters, sorting and submission storage are unchanged.
