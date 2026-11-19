# Provider domain identity and reviewed merging

Final deployed Worker version: `eca416fa-bedd-4518-9230-d8fa1db90027`, November 17, 2026. All migrations through 0035 are applied. Runtime SQL audit covers 132 shapes across the Worker, identity, merge, rollback and preview modules. Full suite result: 67/79 passing, with the 12 previously recorded failures unchanged; all 32 focused merge/cache/image/saved-listing tests pass.

## Behavior

Provider identity uses `tldts` and the ICANN Public Suffix List: protocol, path, query, www and other subdomains do not create distinct providers. Multi-label suffixes such as co.uk and internationalized domains work correctly. All subdomains of shared hosting registrable domains intentionally follow the same rule requested for this directory; private-suffix tenant boundaries are not treated as separate providers.

Submissions query the indexed `provider_domains` registry once. A match is saved privately as a merge proposal instead of rejected or published as another provider. Approval rechecks identity; a transactional domain reservation prevents concurrent approvals from creating two providers. Institutional instructor profiles can remain distinct people associated with one provider. Resubmitted existing instructors retain their original IDs and profile fields; incoming biography/teaching details are included in the provider description comparison, not silently applied to an approved instructor profile.

The admin queue includes **Merge with Existing Provider**. It loads approved and incoming values side by side, supports keeping either value, editing the result, or explicitly combining descriptions. Each conflict requires a choice. Matching services are resolved in place with their original IDs. New services, verified tags and locations are appended. Approved ownership and image-permission fields cannot be granted through an untrusted submission. An official-source verification checkbox is required for merging.

Optimistic revisions and atomic guard rows reject stale or repeated decisions. Provider, offering and relationship changes advance revision guards; rollback also refuses to overwrite later edits. SQL identifiers are from fixed server allowlists. Admin responses remain no-store and authenticated; journals and contact data never enter the public snapshot.

An ownership-verified provider removal archives all same-domain provider aliases and their services together. This prevents an unmerged source from resurfacing as a replacement for a removed canonical provider. No provider or service rows are deleted.

## Existing directory

The initial production audit found 124 published provider rows representing 123 registrable domains. The only duplicate group was **Jeff Cubeta Voice Teaching**:

- Canonical ID: `independent-jeff-cubeta`.
- Retained source ID: `3e3afb6b-d898-4895-a31e-0630dc0edff2`.
- Conflicts requiring editorial approval: description, website URL and source URL.
- Pending review: `domain-merge-1c8cf6ee51b8c275e88ae8beef31700f`.

The domain registry is backfilled, and that conflict is staged in the admin queue. No conflicting approved fields were chosen automatically. Public data now uses a reversible projection: one canonical provider per domain, complementary offerings/terms/locations/instructors grouped together, and alternate provider IDs/slugs retained as aliases. The original database records and text remain intact until explicit merge approval. Source services retain IDs and original content; public provider references point to the canonical provider. Saved listings recognize the old provider IDs.

Old provider HTML/API URLs redirect to the canonical URL with 308 responses. Sitemaps contain only canonical providers. On final approval, source records are archived, relationships are copied or repointed without deleting providers, original scalar and relationship values are journaled, and the snapshot/sitemaps rebuild automatically.

## Preview images

Reviewed approvals enqueue durable `provider_preview_jobs`. Worker `waitUntil` refreshes Open Graph metadata; a Cloudflare Browser Run screenshot is the fallback. Existing verified logos still take precedence through `resolveListingImage`; previews populate the existing metadata image columns. HTTP sites are attempted over HTTPS for safe preview fetching. URLs, DNS answers and redirect destinations are checked against local/private addresses; screenshots disable JavaScript and validate intercepted network destinations. Fetch sizes, redirect counts, timeouts and screenshot size are bounded.

Website metadata/screenshot results are reused from KV for seven days. Screenshot bytes stay in KV and are served by a public cacheable image endpoint with zero D1 reads. Browser state is ephemeral and never authenticated to provider websites. Failed jobs preserve the old image and record a retryable failure. Authenticated POST `/api/admin/preview-retry` retries up to three pending/failed jobs per call, at most three attempts per job. No public request performs scraping or starts a browser.

An end-to-end production test refreshed the already-approved canonical Jeff provider, whose website had no usable OG image. Browser Run produced an 84,549-byte JPEG; its public endpoint returned 200 with zero D1 reads. No conflicting merge was approved to perform this test.

## Validation and operations

- 32 focused tests pass: domain boundaries, internationalized URLs, conflict choices, existing instructor IDs, matching services, atomic/stale review rejection, uniqueness reservations, canonical public projection, redirects/sitemaps, privacy, domain-wide verified removal, cached preview metadata, and guarded rollback.
- Lint, production build and Worker packaging pass. The browser review check verifies three real conflicts side by side, editable fields, verification-gated approval, no mobile overflow and no runtime exceptions. It never approves the merge.
- Expanded production verification checks 956 URLs/actions with no failures, including all published profile APIs/HTML, canonical aliases, all child sitemaps, pagination and unauthorized admin guards. Public requests read zero D1 rows. The authenticated review proposal remains private.
- A live tail sample reports five successful outcomes, no exceptions and no error logs. These are bounded checks, not a promise of no future failures.
- The full suite still has the same 12 unrelated category/catalog-count/legacy validation/SEO fixture failures reported before this task. It is not represented as green.
- Additive migrations 0032–0035 add the pending indexes, domain registry, merge journal, preview jobs and revision guards. They delete no listing data. The offering update duplicate guard permits moving reviewed existing service IDs, while new duplicate inserts remain blocked.

Reports: `provider-domain-audit.json`, `provider-domain-release-check.json`, `provider-merge-browser-check.json`, `provider-preview-job-check.json`, and `launch-log-check.json`.

Run `node scripts/provider-domain-audit.mjs` for a read-only audit after a manual/import change; `--apply` registers domains and stages deterministic pending reviews without selecting conflicts. Normal public browsing never runs this audit. Existing migrations/import files were not reset or replayed.

## Rollback

The pre-release Worker is `d94dbad2-5811-44df-914d-105d36da7a05`. Roll back the Worker through Wrangler if required, leaving additive schema in place. A Worker rollback also removes public domain projection until the release is restored; re-invalidate caches to avoid incompatible rendered content. It does not undo approved data changes.

Each approved merge returns `mergeEventId`. Authenticated POST `/api/admin/provider-merge/rollback` with `{"event_id":"..."}` restores the affected approved fields, original relationships and service values, reopens the submission, and refreshes the snapshot. It refuses if provider/relationship revisions changed after the merge. Newly created service/instructor content is archived rather than deleted; association rows created by the merge can be removed only while the complete before-state is restored atomically. The domain-based public projection remains in effect, so rolling back a merge restores the review and original data without publishing duplicate providers again.

D1 recovery bookmark captured before schema/backfill: `0000020f-00000000-00005126-1271d0c36475728a62ef0557d2722b0a`. A full-database recovery is a last resort requiring explicit coordination because it would also revert unrelated later submissions. A proposed full local SQL export was rejected by automatic approval review for potentially exporting private submission/contact data; no full export was performed. D1's recovery bookmark and remote merge-specific journals provide rollback without that export.

References: [tldts registrable domains](https://github.com/remusao/tldts), [Cloudflare browser binding](https://developers.cloudflare.com/browser-run/how-to/deploy-worker/).
