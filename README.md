# Vocal Catalog

An independent directory of vocal coaches, voice teachers and singing classes in New York City. Listings focus on source-backed lesson specialties, singing styles, verified teaching formats and published prices.

Production: [vocalcatalog.com](https://vocalcatalog.com). The existing Worker and D1 resource names are retained. The old public workers.dev host and www.vocalcatalog.com permanently redirect to the canonical apex domain.

## Local development

Requirements: Node.js 22 or newer and npm.

```sh
npm install
npm run db:migrate:local
npm run preview
```

The default Wrangler configuration uses local-only D1. `wrangler.production.jsonc` targets the acting directory's production Worker and its dedicated D1. The production configuration binds vocalcatalog.com and www.vocalcatalog.com as Worker Custom Domains and sets the apex HTTPS origin as canonical. Development and unrelated preview hosts are not redirected.

## Production deployment

Build and deploy with the explicit production configuration:

```sh
npm run build
npm test
npx wrangler deploy --config wrangler.production.jsonc
```

The Cloudflare Vite plugin writes browser files to `dist/client` and local Worker files to `dist/acting_class_directory_local`. Production assets must point to `dist/client`. Never upload the whole `dist` directory: it includes generated server code and local development secrets.

Before deploying code that changes the database schema, review the pending SQL and the production target, save a database export, then apply the reviewed migrations using `wrangler d1 migrations apply acting-class-directory --remote --config wrangler.production.jsonc`. The Worker and database schema must be updated together; missing migrations cause the directory API to return 503. Keep database exports in the ignored `.wrangler` directory.

`npm run dev` starts the Vite development server for frontend work. Use `npm run preview` when you need the local Worker and D1 binding. The Vite dev server proxies Worker requests through the Cloudflare Vite plugin.

## Local environment variables

Set `ADMIN_REVIEW_KEY` in your ignored `.dev.vars` file for local `/admin/review` access. `.dev.vars.example` documents the variable name and placeholder only. The production Worker uses a separately generated Cloudflare secret; the matching key is in your local ignored `.dev.vars` file. Never commit `.dev.vars` or production values.

## Database

`migrations/0001_acting_directory_schema.sql` defines the original schema. Migrations `0002`–`0005` add source evidence, individual teacher profiles and related features. `0006_nyc_voice_directory.sql` archives the acting-only starter listings, adds verified voice-teaching formats and vocal taxonomies, and seeds 20 source-backed NYC voice-teacher profiles plus one sourced group-singing-class listing. It preserves the archived acting records rather than deleting them. Apply migrations to local D1 only:

```sh
npm run db:migrate:local
```

The seeded coach profiles draw from New York Vocal Coaching's official staff roster and the New York Singing Teachers' Association's teacher directory. Association directory listings are labeled as such because personal websites and booking details were not available from that source. Schedules and prices are not invented; confirm current availability and details with each coach or school. Migrations through `0008` were reviewed and applied to the dedicated production D1 on November 10, 2026, with database exports saved before the catalog expansions. Review the SQL and target before applying any further remote migration.

## Local editorial workflow

The reviewed expansion in `data/nyc-catalog-expansion.js` and migration `0007_expand_nyc_voice_directory.sql` adds 66 coaches and 13 classes, bringing the initial public catalog to 100 listings (86 coaches and 14 classes). See [catalog research notes](docs/catalog-expansion.md) for source and verification boundaries. School affiliations are not separate coach listings. Unstated private-lesson availability, prices, teaching formats and image rights remain unknown.

The second reviewed expansion in `data/nyc-catalog-expansion-200.json` and migration `0008_expand_voice_directory_to_200.sql` adds 100 distinct instructors, bringing the catalog to **200 listings: 186 instructors and 14 classes**. Every addition has an official website and verified affiliated logo. See [the 200-listing source notes](docs/catalog-expansion-200.md) and [logo verification](docs/logo-verification.md). University faculty entries identify enrollment restrictions; cross-school affiliations do not duplicate people.

Voice-school, class and coach suggestions, claims and profile updates are saved as pending in D1. Open `/admin/review` and enter the appropriate review key to approve or reject them. Approval publishes a listing; submitted details remain marked unverified until checked against an official source. No mail integration is configured.

## Directory routes

- `/` — homepage
- `/directory` — all listing types and fundamental filters
- `/studios`, `/classes`, `/coaches` — type-specific views
- `/providers/:slug` and `/classes/:slug` — indexable profiles
- `/admin/review` — authenticated editorial queue

## Isolation

See [the isolation checklist](docs/isolation-checklist.md) and [the Phase 1 audit](docs/phase-1-audit.md). Deployment is performed manually with Wrangler; no automatic deployment workflow is configured.

## Launch verification

For the D1 read-cost audit, cache behavior, production measurements and safe migration/invalidation commands, see [D1 optimization](docs/d1-optimization.md).

The directory also has a five-minute browser localStorage cache. See [browser caching](docs/browser-directory-cache.md) for revision invalidation, saved-data fallback and live verification.

Run `npm run lint`, `npm test`, `npm run seo:audit`, and `npm run build` before deploying. See [the launch report](docs/vocal-catalog-launch.md) for domain status, live SEO checks, browser evidence, and manual Search Console steps. `scripts/check-live-launch.mjs` verifies the live sitemap, metadata, redirects, images, and unchanged public directory data against the recorded baseline. `scripts/check-launch-browser.mjs` uses an existing headless Chrome CDP session on port 9223; set SITE_ORIGIN and QA_LABEL to target local preview or production. No launch check writes production data.
