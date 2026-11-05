# Acting Class Directory

Independent, local-first groundwork for a directory of acting studios, schools, classes, workshops and private coaches in New York City.

## Local development

Requirements: Node.js 22 or newer and npm.

```sh
npm install
npm run db:migrate:local
npm run preview
```

Wrangler is configured with a local-only D1 binding. There is no account ID, custom domain, production database ID, remote binding, or deployment command in the package scripts. The current app is a design foundation, not a complete directory.

`npm run dev` starts the Vite development server for frontend work. Use `npm run preview` when you need the local Worker and D1 binding.

## Local environment variables

Copy `.dev.vars.example` to `.dev.vars` only if developing future integrations that need those names. The current application does not require external credentials. Never place production values in this repository.

## Database

`migrations/0001_acting_directory_schema.sql` defines the independent acting education schema. Apply it to local D1 only:

```sh
npm run db:migrate:local
```

The database starts without provider or photographer data. Do not run remote migrations.

## Isolation

See [the isolation checklist](docs/isolation-checklist.md) and [the Phase 1 audit](docs/phase-1-audit.md). This repository has no deployment workflow. Any future production infrastructure must be separately reviewed before configuration or deployment is added.
