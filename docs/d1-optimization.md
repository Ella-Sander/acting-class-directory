# D1 read optimization — November 15, 2026

Implemented and deployed to **https://vocalcatalog.com**. Final Worker version: `09c6ad8a-7f89-4182-a2f2-a5d06a0b1347`.

The existing Worker, database, branding, frontend assets, filters, sorting, profile fields and SEO routes were retained. No paid plan was enabled. No existing listing data was updated, removed, imported or recreated. Only additive indexes and public-cache infrastructure were introduced.

## Causes established by measurement

1. The original three-query directory load read **15,743 rows**: 628 for providers, 479 for offerings, and 14,636 for teachers. That is **5,247.7 rows per query**, closely matching the reported roughly 5,240.
2. Before the change, an instructor's affiliation lookup started with all published providers; its course lookup started with all published offerings. The existing relationship primary keys begin with `provider_id` or `offering_id`, so they do not efficiently support instructor-first lookups. Production EXPLAIN plans confirmed those repeated lookups. Reverse composite indexes let each instructor start with only its own relationships.
3. `field_evidence` already had a primary-key index on entity/type/field. It was not wholly unindexed. Entity verification and latest-date lookups benefit from an additional covering index including verification status and date. Public name ordering also required temporary NOCASE sorts.
4. The prior 30-second WeakMap was confined to an isolate/binding identity, did not coalesce simultaneous loads, and was not a shared cache. Public API responses used no-store. Cache-Control on HTML/sitemaps alone did not implement a cache lookup before D1.
5. Public profile APIs, profile HTML, modal aliases, and even unknown/admin document paths previously went through the full directory load. The earlier full-sitemap launch checker visited every sitemap URL and therefore contributed verification traffic to this expensive path. Its exact fraction of daily usage cannot be attributed without historical request logs; it should have included a read-cost check before that crawl.

### Was quota exhaustion the outage cause?

**Not confirmed.** Historical GraphQL analytics showed 7,320,376 successful row reads across 1,397 read queries in Cloudflare's November 14 UTC bucket, and 4,108,923 across 783 queries in the November 15 UTC bucket at the time of the initial audit. These results establish substantial read amplification. They do not establish which error caused a past failed HTTP request, nor whether the relevant account was subject to a particular cap at that moment.

The available records did not contain a historical D1 quota-exceeded exception, and production measurement queries succeeded during this audit. Existing persistent Worker observability was disabled; historical exception logs were unavailable. Cloudflare documents quota-enforcement failures, but successful execution analytics alone do not prove one occurred. D1 also notes that failures before SQL execution may not appear in this dataset. The generic browser message could result from any caught database read failure. The code now logs query names, actual meta.rows_read, database duration, elapsed binding-call duration and sanitized failure messages without parameters, making future live-tail diagnosis more precise.

References: [D1 metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/), [free-tier enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/).

## Measured production results

These are actual production D1 API `meta.rows_read` values, not local estimates. Durations are single database-only samples in milliseconds, not end-to-end request latency or a promise of consistent timing.

| Query | Before rows | Final rows | Before ms | Final ms |
| --- | ---: | ---: | ---: | ---: |
| Providers, 22 records | 628 | 584 | 3.2231 | 3.1941 |
| Offerings, 29 records | 479 | 388 | 1.9907 | 2.1386 |
| Teachers, 216 records | 14,636 | 3,730 | 13.0165 | 9.2270 |
| Full directory | **15,743** | **4,702** | — | — |

The final uncached directory read cost is **70.1% lower**. Relationship aggregation has explicit ordering so the new join plans preserve existing affiliation order, associated program order, and logo choices. That preservation is included in the final row counts above.

Live HTTP checks then established:

- After an authenticated cache-generation rotation, `/api/directory` returned **3 D1 queries / 4,702 rows**, followed by **0 queries / 0 rows** on the identical repeated request.
- A cold teacher API request for Abby Payne returned **1 query / 22 rows**, instead of the former full-directory path. A representative provider and class request each used **1 query / 16 rows**. Each repeated API request returned **0 / 0**.
- The homepage, profile HTML, sitemap index, coaches sitemap, filters and institute sorting all returned **0 / 0** on repeated representative requests. Parameterized search/filter/sort HTML remains no-store and uses the shared public-data snapshot; it is not response-cached.
- A cold response at a location with an already-warm global directory snapshot can also avoid D1 completely. The report distinguishes `MISS` from database activity; MISS is not assumed to mean a D1 query ran.

Evidence: [before production metrics and plans](d1-before-production.json), [final production metrics and plans](d1-after-production.json), [live requests](d1-live-cache.json), [live invalidation/cold refresh](d1-live-invalidation.json), and [historical usage](d1-usage-audit.json).

### Local measurements and regression results

Node's local SQLite fixture provides EXPLAIN plans and elapsed durations but does not expose Cloudflare billing row counts. Its `rows_read` values are explicitly null in [before](d1-before-local.json) and [after](d1-after-local.json) reports. Local query counts in tests come from an instrumented in-memory fixture, not invented billing measurements.

All **42 automated tests** pass, including nine cache/read regressions. Tests cover cross-request and cross-colo snapshot reuse, single-record profile access, exact old/new data equality, publication invalidation, real submission and approval SQL bindings, private data exclusion, stale fallback, genuine 503s without previous success, coalesced requests, and deployment-specific HTML keys. Build and syntax/merge-marker lint passed.

## Cache behavior

- **Workers KV** stores a global, published-only directory snapshot and a generation identifier. The namespace is dedicated to this public cache. No submitted contact details, pending submissions, admin responses or private data are written there.
- **Cache API** stores public responses and record data for reuse across isolates in a Cloudflare location. This is real `.match()`/`.put()` caching, checked before D1, rather than relying only on response headers or a module variable. [Cache API is local to a data center](https://developers.cloudflare.com/workers/runtime-apis/cache/); KV allows cold locations to reuse the shared directory snapshot.
- Freshness is **10 minutes**. Successful stale copies are retained for at most **24 hours** for temporary failure recovery. Stale responses have `X-Public-Cache: STALE`, a Warning header and no-store. They are not promoted to fresh cache entries after a failed database read. Without a usable previous success, the original 503 behavior remains; errors never become empty directory results or cached successes.
- Approvals, rejections and saved claims rotate the global generation. Old response, directory, profile and sitemap keys become unreachable. KV propagation/cached reads can take approximately **60 seconds** between locations. A failed invalidation is logged, and the approval API exposes `cacheInvalidated: false` rather than claiming success for that step.
- Rendered Cache API keys include the automatic Worker version ID, so a deployment cannot serve HTML pointing to obsolete JavaScript assets. A schema label versions the global snapshot format.
- Profile APIs query just one slug and its relationships on a cold record lookup. Profile HTML uses that record plus the **shared catalog snapshot** for the unchanged global exploration links, counts and related listings. A genuinely absent/expired global snapshot can still require one three-query catalog refresh; it is not loaded from D1 separately for every profile. Normal repeated requests use the caches first.
- Unknown document paths and administrative HTML no longer load the directory. Existing React behavior is unchanged; its directory API request now uses the public snapshot.

## Data and functionality preservation

The pre-index production export was loaded into isolated local SQLite, queried with the original SQL, then indexed and queried with the new SQL. **Every public field, relationship order, listing order and resolved logo matched exactly.** [Parity report](d1-data-parity.json).

The live API's complete payload SHA-256 still equals the pre-launch baseline:

`8484d373909ca70af97204d2f83f9a6fc58a39c3e156890b96e0279ed144a99b`

Counts remain 216 teachers, 29 offerings and 22 providers. All **345 sitemap URLs**, canonicals, unique titles/descriptions, H1s, structured data and internal discovery links passed the live SEO check, as did all 41 logos and the existing redirects. The browser checks passed desktop, laptop, 390px and 320px layouts, search, category filters, pagination, modal/back navigation, direct profiles and empty-state reset. Browser asset hashes did not change in this optimization. [Live SEO evidence](launch-live-checks.json), [browser evidence](launch-browser-d1-cache.json).

## Files changed in this task

| File | Change |
| --- | --- |
| `src/directory-data.js` | Extracted unchanged public field projections/normalization; measured query execution; slug-specific queries; explicit legacy relationship order. |
| `src/public-cache.js` | Public KV snapshots, Cache API response/data layers, coalescing, versioned keys, bounded freshness and stale-success fallback. |
| `src/worker.js` | Read-through directory service, targeted profile API, cache wrappers, editorial invalidation and protected manual invalidation endpoint. Existing submission/email/admin handling retained. |
| `src/seo.js` | Targeted profile/alias access, cached catalog for global SEO context, and no D1 directory hydration for unknown/admin documents. |
| `migrations/0013_directory_read_indexes.sql` | Six idempotent additive indexes; no table drops/rebuilds or listing changes. |
| `wrangler.production.jsonc` | Public KV namespace binding and automatic Worker version metadata. Existing D1/email/secrets/domain configuration retained. |
| `scripts/seo-fixture.mjs`, `test/seo.test.js` | Optional shared-cache fixture and awaited invalidation in SEO tests. |
| `test/public-cache.test.js` | Nine focused regressions for caching, invalidation, failures, targeted reads and exact data parity. |
| `scripts/measure-d1.mjs`, `scripts/audit-d1-usage.mjs`, `scripts/check-d1-data-parity.mjs` | Repeatable query metrics/plans, historical analytics and original-output comparison. |
| `scripts/setup-public-cache.mjs` | Reuses or creates the dedicated public KV namespace; never upgrades an account. |
| `scripts/check-live-d1-cache.mjs`, `scripts/check-live-cache-invalidation.mjs` | Public production cache/read checks and authenticated generation rotation without editing listings. |
| `scripts/check-email-connection.mjs` | Renamed the earlier manually invoked email diagnostic from `test-email-connection.mjs` so Node test discovery cannot accidentally invoke a production email test. |
| `docs/d1-*.json`, this report, `README.md` | Measurement evidence and operational instructions. |

## Migration and deployment steps

Completed in production:

1. Inspected existing indexes and captured the original SQL, real D1 metrics and query plans.
2. Saved an export to ignored `.wrangler/d1-before-read-indexes-2026-11-15.sql`. Export and migration operations briefly require D1 availability coordination; they completed successfully. The export may contain private records and must not be committed or published.
3. Confirmed only migration 0013 was pending and applied it successfully. It adds reverse instructor indexes, a verification covering index and three matching NOCASE public-order indexes.
4. Created/reused public KV namespace `vocal-catalog-public-cache` (`ae2e93595aa44ff59041a94ef36f7358`) and deployed its binding plus Worker version metadata.
5. Deployed, verified live cache invalidation, observed the cold 4,702-row refresh and subsequent zero-read cache hit, and ran the live application/SEO checks.

No deployment action remains required. For future deployments from PowerShell:

```powershell
$env:WRANGLER_LOG_PATH = "$PWD\node_modules\.cache\wrangler-logs"
npm.cmd run lint
npm.cmd test
npm.cmd run build
npx.cmd wrangler d1 migrations list acting-class-directory --remote --config wrangler.production.jsonc
# Review any new migrations before applying; 0013 is already applied.
npx.cmd wrangler deploy --config wrangler.production.jsonc
node scripts/check-live-d1-cache.mjs
```

For local persistent D1, apply the additive migration with `npm.cmd run db:migrate:local` before comparing local development plans. The automated fixtures already apply all migrations.

After an intentional manual production D1 edit/unpublish outside the existing approval flow, rotate the public cache using:

```powershell
node scripts/check-live-cache-invalidation.mjs
```

That script uses the existing local review credential without printing it, calls the protected `/api/admin/cache/invalidate` endpoint, then warms/verifies the directory cache. It changes KV cache state only. If the local credential is unavailable, an authenticated administrator can POST that endpoint with the existing Bearer review key.

## Remaining limits

- Historical quota exhaustion remains unproven; daily metrics are not an exception log. No paid plan or quota was changed.
- Cold refreshes still incur D1 reads. The directory keeps its indexed, now-bounded relationship subqueries rather than an unnecessary broad query rewrite. Each cold profile record is still a small D1 query; global SEO context occasionally needs a shared snapshot refresh.
- Cache API is regional; KV is eventually consistent. Simultaneous cold requests in different isolates/regions can occasionally duplicate a refresh. Same-isolate refreshes are coalesced. This design does not add a paid coordination service or one D1 version query per HTTP request.
- KV operations use the existing account's limits. Only the directory snapshot and editorial generation use KV writes; per-profile data and rendered pages use Cache API to keep global write volume low. KV/cache errors are handled without discarding database successes. An invalidation failure can leave older fresh content until TTL expiry; the response flag/log supports retry.
- Stale fallback is deliberately limited to previous successful public data, within the same known generation and at most 24 hours. It cannot invent a successful result when there is no cached copy. Manual data changes must use invalidation for prompt visibility.
- This audit did not perform a production submission or approve a dummy listing. Those flows were exercised transactionally in the isolated test database; live invalidation was tested separately without changing listings. Persistent observability settings remain unchanged; query console metrics can be captured with live tail, while the saved reports contain the measured samples.
