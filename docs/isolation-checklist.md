# Isolation checklist

Status: Isolated application deployed by explicit approval. Recheck this document before adding resources, integrations or automated deployment.

- [x] Replaced the copied Git history with a new independent repository and verified the sole remote is `acting-class-directory`.
- [x] Removed the prior GitHub remote from the working `.git` config.
- [x] Removed all inherited Cloudflare identifiers and routes. The active production config now contains only the separately approved acting-directory Worker and D1; no custom domain is configured.
- [x] Kept the default `DIRECTORY_DB` binding local (`remote: false`) and configured a separate production Worker config for the acting directory only.
- [x] Removed inherited deployment workflow and deploy script; production upload is a deliberate manual Wrangler action.
- [x] Removed inherited analytics, ad tags, domain canonicals, mailbox identity, OAuth helper, Gmail approval flow, and Resend usage from application source.
- [x] Removed copied photographer records, branding data, photographer migrations and tests.
- [x] Added `.dev.vars.example` with placeholder names only; no secret values are present.
- [x] Public page metadata, canonical profile URLs and structured data are generated from the current local origin; `robots.txt` and sitemap are served dynamically.
- [x] Checked tracked application files for inherited production identifiers and endpoint strings.
- [x] Provisioned a new `acting-class-directory` Worker binding and independent D1; no custom domain was configured.
- [ ] Before any custom domain or automated deployment: review the domain, DNS/route ownership and isolated deployment workflow.
- [ ] Before any email integration: separately authorize a new mailbox/sender and create new credentials; Gmail polling is out of scope.
- [x] Verified the deployed sitemap/robots and dynamic profile canonical/structured metadata use the acting-directory Worker origin.

Verification boundary: source/config checks show no inherited production identifiers, routes, remote database bindings or deployment workflow. The explicit production config targets the acting-directory Worker and its independent D1. These checks cannot inspect unrelated resources or credentials outside this project.
