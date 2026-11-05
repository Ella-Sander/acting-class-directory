# Acting Class Directory

An independent, local-first directory of acting studios, schools, classes, workshops and private coaches in New York City.

## Local development

Requirements: Node.js 22 or newer and npm.

```sh
npm install
npm run db:migrate:local
npm run preview
```

Wrangler is configured with a local-only D1 binding. There is no account ID, custom domain, production database ID, remote binding, or deployment command in the package scripts. The current app is a design foundation, not a complete directory.

`npm run dev` starts the Vite development server for frontend work. Use `npm run preview` when you need the local Worker and D1 binding. The Vite dev server proxies Worker requests through the Cloudflare Vite plugin.

## Local environment variables

The local preview command supplies a loopback-only review key (`local-review-key-change-me`) for `/admin/review`. `.dev.vars.example` documents the variable name if you want to use a different local value. The application does not require external credentials. Never put production values in this repository.

## Database

`migrations/0001_acting_directory_schema.sql` defines the independent acting education schema. `0002_seed_reviewed_nyc_listings.sql` adds a small source-linked starter directory. Apply migrations to local D1 only:

```sh
npm run db:migrate:local
```

The new database has no photographer records. The starter listings include source URLs and verification evidence; check current schedules and prices with providers before enrolling. Do not run remote migrations.

## Local editorial workflow

Provider, class and coach suggestions, claims and profile updates are saved as pending in local D1. Open `/admin/review` and enter your local review key to approve or reject them. Approval publishes a listing locally; submitted details remain marked unverified until checked against an official source. No mail integration is configured.

## Directory routes

- `/` — homepage
- `/directory` — all listing types and fundamental filters
- `/studios`, `/classes`, `/coaches` — type-specific views
- `/providers/:slug` and `/classes/:slug` — indexable profiles
- `/admin/review` — local-only editorial queue

## Isolation

See [the isolation checklist](docs/isolation-checklist.md) and [the Phase 1 audit](docs/phase-1-audit.md). This repository has no deployment workflow. Any future production infrastructure must be separately reviewed before configuration or deployment is added.
