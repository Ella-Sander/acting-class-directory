# Isolation checklist

Status: Phase 2A foundation complete; local-only. Recheck this document before adding infrastructure or deployment support.

- [x] Replaced the copied Git history with a new independent repository and verified the sole remote is `acting-class-directory`.
- [x] Removed the prior GitHub remote from the working `.git` config.
- [x] Removed the inherited Cloudflare account ID, D1 ID, database name, Worker name, custom domains and routes from Wrangler config.
- [x] Bound only `DIRECTORY_DB` to a local D1 database with `remote: false` and a non-production placeholder ID.
- [x] Removed the inherited deployment workflow and deploy package script.
- [x] Removed inherited analytics, ad tags, domain canonicals, mailbox identity, OAuth helper, Gmail approval flow, and Resend usage from application source.
- [x] Removed copied photographer records, branding data, photographer migrations and tests.
- [x] Added `.dev.vars.example` with placeholder names only; no secret values are present.
- [x] Set page robots metadata and `robots.txt` to disallow indexing while this is a foundation preview.
- [x] Checked tracked application files for inherited production identifiers and endpoint strings.
- [ ] Before any production work: choose the public brand/domain, provision separate Cloudflare resources, and review a concrete isolated configuration.
- [ ] Before any email integration: separately authorize a new mailbox/sender and create new credentials; Gmail polling is out of scope.
- [ ] Before launch: restore indexability only for reviewed, published listings and verify sitemap/metadata use the approved new origin.

Verification boundary: source/config checks prove the repository itself has no configured route, account ID, remote database binding, deployment workflow or deployment script. They cannot inspect external GitHub/Cloudflare account settings or prove that credentials do not exist outside this workspace.
