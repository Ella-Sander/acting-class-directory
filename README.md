# Acting Class Directory

An independent directory of acting studios, schools, classes, workshops and private coaches in New York City.

The public Worker is live at [acting-class-directory.ellasanderella.workers.dev](https://acting-class-directory.ellasanderella.workers.dev). Its only database binding is the separately provisioned `acting-class-directory` D1 database.

## Local development

Requirements: Node.js 22 or newer and npm.

```sh
npm install
npm run db:migrate:local
npm run preview
```

The default Wrangler configuration uses local-only D1. `wrangler.production.jsonc` targets the acting directory's production Worker and its dedicated D1. The production configuration has no custom domain; the Worker is served from its `workers.dev` URL.

`npm run dev` starts the Vite development server for frontend work. Use `npm run preview` when you need the local Worker and D1 binding. The Vite dev server proxies Worker requests through the Cloudflare Vite plugin.

## Local environment variables

Set `ADMIN_REVIEW_KEY` in your ignored `.dev.vars` file for local `/admin/review` access. `.dev.vars.example` documents the variable name and placeholder only. The production Worker uses a separately generated Cloudflare secret; the matching key is in your local ignored `.dev.vars` file. Never commit `.dev.vars` or production values.

## Database

`migrations/0001_acting_directory_schema.sql` defines the independent acting education schema. `0002_seed_reviewed_nyc_listings.sql` adds a small source-linked starter directory. Apply migrations to local D1 only:

```sh
npm run db:migrate:local
```

The databases contain no photographer records. Starter listings include source URLs and verification evidence; check current schedules and prices with providers before enrolling. Both migrations have been applied to the dedicated production D1 for this deployment. Do not apply further remote migrations without reviewing the change and target.

## Local editorial workflow

Provider, class and coach suggestions, claims and profile updates are saved as pending in D1. Open `/admin/review` and enter the appropriate review key to approve or reject them. Approval publishes a listing; submitted details remain marked unverified until checked against an official source. No mail integration is configured.

## Directory routes

- `/` — homepage
- `/directory` — all listing types and fundamental filters
- `/studios`, `/classes`, `/coaches` — type-specific views
- `/providers/:slug` and `/classes/:slug` — indexable profiles
- `/admin/review` — authenticated editorial queue

## Isolation

See [the isolation checklist](docs/isolation-checklist.md) and [the Phase 1 audit](docs/phase-1-audit.md). Deployment is performed manually with Wrangler; no automatic deployment workflow is configured.
