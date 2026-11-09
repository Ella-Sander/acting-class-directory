# Voxline NYC

An independent directory of vocal coaches, voice teachers and singing classes in New York City. Listings focus on source-backed lesson specialties, singing styles, verified teaching formats and published prices.

The existing public Worker is live at [acting-class-directory.ellasanderella.workers.dev](https://acting-class-directory.ellasanderella.workers.dev). Its deployment and D1 resource names are retained during the product transition.

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

`migrations/0001_acting_directory_schema.sql` defines the original schema. Migrations `0002`–`0005` add source evidence, individual teacher profiles and related features. `0006_nyc_voice_directory.sql` archives the acting-only starter listings, adds verified voice-teaching formats and vocal taxonomies, and seeds 20 source-backed NYC voice-teacher profiles plus one sourced group-singing-class listing. It preserves the archived acting records rather than deleting them. Apply migrations to local D1 only:

```sh
npm run db:migrate:local
```

The seeded coach profiles draw from New York Vocal Coaching's official staff roster and the New York Singing Teachers' Association's teacher directory. Association directory listings are labeled as such because personal websites and booking details were not available from that source. Schedules and prices are not invented; confirm current availability and details with each coach or school. The earlier acting-directory migrations were applied to the dedicated production D1. Do not apply `0006` or any further remote migration without explicitly reviewing the change and target.

## Local editorial workflow

Voice-school, class and coach suggestions, claims and profile updates are saved as pending in D1. Open `/admin/review` and enter the appropriate review key to approve or reject them. Approval publishes a listing; submitted details remain marked unverified until checked against an official source. No mail integration is configured.

## Directory routes

- `/` — homepage
- `/directory` — all listing types and fundamental filters
- `/studios`, `/classes`, `/coaches` — type-specific views
- `/providers/:slug` and `/classes/:slug` — indexable profiles
- `/admin/review` — authenticated editorial queue

## Isolation

See [the isolation checklist](docs/isolation-checklist.md) and [the Phase 1 audit](docs/phase-1-audit.md). Deployment is performed manually with Wrangler; no automatic deployment workflow is configured.
