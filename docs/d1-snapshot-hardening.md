# D1 snapshot hardening — November 16, 2026

## Deployment update

Deployed with user authorization on November 16, 2026. Current Worker version: `12546012-fc45-4ade-85ef-74c0edbd4cb8`. Previous version for rollback: `061bda40-a127-4847-9051-755724d8c6fe`.

Cloudflare D1 returned quota error 7500 during the migration-status check. Migration 0033 could not be applied and remains pending verification/application after the daily quota resets; no production SQL migrations or data edits were performed. Do not rotate the snapshot merely to warm it during quota exhaustion, because a rebuild cannot succeed.

The deployed release separates rendered-response namespace v9 from unchanged durable snapshot format v8. It reuses the existing snapshot and generation, preventing an empty-cache rollout from querying the exhausted database. The new outage/rollout regression test explicitly seeds the old snapshot and verifies public browsing with D1 unavailable. Twenty focused tests, lint and build pass. The full-suite issues documented below remain; they are not represented as passing. Expanded live verification completed: 956 checks, including all 938 profile API/HTML URLs, pagination, missing routes, sitemap children and unauthenticated admin guards; zero failures and zero D1 reads.

Before deployment, sampled provider/class routes returned 503. After deployment, all 24 initial HTTP checks return 200 with zero D1 queries/rows read and no failures; the public payload hash is unchanged. A short live tail captured five successful outcomes, no exceptions, and no error logs. See `d1-deploy-before.json`, `d1-live-cache.json`, `launch-log-check.json`, and `d1-deployment-verification.json` for expanded route checks. These checks establish sampled behavior, not a guarantee of no future errors. D1-backed administration/submission operations remain subject to the exhausted quota until reset.

Rollback command: `npx.cmd wrangler rollback 061bda40-a127-4847-9051-755724d8c6fe --config wrangler.production.jsonc`. This changes the Worker only. A rollback would restore per-profile D1 access, so it would also restore the quota-related profile outage while D1 is unavailable.

## Implemented in this change

- All public profile APIs, profile HTML, aliases and nonexistent slugs now resolve from the same normalized, published-only directory snapshot. No per-slug D1 query or negative-cache key explosion. Existing URLs, provider identities, filters, related links and SEO rendering are retained.
- Reviewed writes rotate the generation and eagerly rebuild its snapshot after the D1 transaction commits. Rebuild failures retain the existing `cacheInvalidated: false` retry signal; POST `/api/admin/cache/invalidate` retries without repeating an approval.
- Added bounded, 60-second in-isolate data reuse, keyed by database identity and generation. KV and Cache API remain the shared sources; memory is disposable. In-flight refresh coalescing still applies.
- Fixed an existing HTML cache-key collision: `/?page=2` must not reuse `/`. Only `/api/directory` ignores `page`. Namespace v9 prevents reuse of v8 rendered pages.
- Request-scoped D1 metrics cover reads and batches in submissions, admin decisions and public rendering. Logs contain endpoint class, method, status, query count and rows read; no parameters or private fields. Headers use `unknown` when metadata is unavailable, rather than claiming zero. Production observability remains disabled; headers work without persistent logs.
- Migration 0033 adds duplicate-check expression indexes, submission-to-claim/update indexes and missing foreign-key indexes. It changes no records and imposes no new uniqueness rules.

## Audit and measurement

`node scripts/audit-runtime-sql.mjs` explains 67 runtime SQL shapes using all migrations in an isolated SQLite database. See `d1-runtime-query-plans.json`. Dynamic approval taxonomy inserts use allowlisted tables and primary keys. Remaining `SCAN v` / `SCAN t` entries consume bounded relationship UNION results, rather than full base tables. Public full-catalog enumeration is intentional and occurs only on snapshot rebuild/expiry; eliminating it would prevent producing the snapshot.

No cron, queue handler or frontend polling timer is configured. Admin refresh is explicit. Browser loading already coalesces requests and caches the full directory; filtering, sorting and pagination operate in memory. There are no runtime SQL COUNT queries. Historical research/import/audit scripts are explicit operator tools, not scheduled browsing work.

Previously saved production analytics show 7,320,376 rows read on November 14 and 4,108,923 on November 15 (`d1-usage-audit.json`). Saved SQL before/after and HTTP reports predate this change and are not new deployment measurements. SQLite does not provide Cloudflare billing rows; this change does not invent before/after production numbers.

New regression evidence: 11 cache tests pass, including all three profile types preserving their API payload, cached pagination separation, cross-colo missing slugs requiring no additional D1 queries, approval rebuilds, archive invalidation, private data exclusion, concurrent loads, stale fallback and expiry. After the initial three-query snapshot build, all tested profile URLs use zero D1 queries; empty-colo browsing uses KV. A fully cold/expired snapshot still needs three catalog queries. Other isolates may duplicate cold rebuilds.

Lint and production build pass. Full suite: 54/66 pass, 12 fail in category, catalog-count, validation, logo and SEO expectations. Example: tests expect 22 providers while the current full-migration fixture contains 122; legacy submission fixtures omit now-required offering fields. Do not treat the full suite as green or deploy automatically based on this report.

## Snapshot architecture decision

The existing version-keyed KV JSON snapshot plus Cache API is the least disruptive CDN-backed architecture: it supports unchanged public API URLs and server-rendered SEO without new infrastructure. This change extends it to every public profile. Snapshot generation uses existing reviewed normalization, not a second exporter that could expose pending data. A separate immutable public `/snapshots/version.json` URL is deliberately not added: it would keep removed listings retrievable after moderation and require an additional revocation mechanism. D1 remains authoritative for submissions and administration. KV snapshots expire after seven days; normal refresh is daily and rendered response TTL is one hour.

KV generation propagation is eventually consistent (including its 60-second read cache); this is bounded editorial staleness, not immediate global revocation. Browser saved-data fallback can retain previously public listings for 24 hours offline. Never place confidential fields in public listing records. Strict immediate takedown would require a strongly consistent revocation check or purge/coordination service; a versioned immutable URL alone cannot provide that guarantee.

## Rollout and rollback

No production deployment or production data mutation was performed for this change. The workspace contains substantial prior uncommitted work; do not reset or overwrite it.

1. Review migration 0033 and resolve or explicitly account for the full-suite failures. Capture the currently deployed Worker version ID for rollback.
2. Apply only reviewed outstanding additive migrations with the production config; do not blindly apply unrelated pending catalog imports.
3. Deploy with `wrangler.production.jsonc`, then invoke authenticated POST `/api/admin/cache/invalidate` to build the v9 snapshot. Confirm `ok: true`.
4. Run `node scripts/check-live-d1-cache.mjs` and inspect actual `X-D1-Rows-Read` / `X-D1-Queries` for directory, profiles, sitemaps and filtered pages. Repeat from a second region if available. Re-run the production SQL measurement only once to limit diagnostic reads. Compare daily account metrics after a full day.
5. Roll back the Worker to the recorded deployment version if needed. Leave additive indexes in place; they do not change data semantics. Prior v8 and new v9 caches are separated, and expire naturally. Re-invalidate using the rolled-back version to reflect intervening editorial changes. Do not roll back or replay approved data writes.

Cloudflare references: [query costs and caching](https://developers.cloudflare.com/d1/observability/find-expensive-queries/), [binding row-count metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/).
