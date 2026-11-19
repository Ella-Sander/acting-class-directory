# Vocal Catalog provider-directory audit and migration proposal

Audit date: November 15, 2026  
Scope: read-only production D1 inspection plus repository/schema review. At audit time, no production data was changed. Migrations `0015_provider_identity_registry.sql` and `0016_backfill_reviewed_provider_identity.sql` were applied only to local D1; the user later approved proceeding with the implementation, production migrations, and deployment after reviewing this plan.

## Findings

### Production inventory

| Entity | Published count | Audit note |
| --- | ---: | --- |
| Providers | 22 | 18 stored as `school`, 4 as `studio`; all have a website URL. |
| Instructors | 216 | All 216 have a null `teacher_type`; 179 link to at least one provider, 37 do not. |
| Offerings | 29 | All 29 already have a provider relationship. |

The 22 current provider IDs are distinct and should be retained as the initial canonical provider set:

| Existing provider | Current type | Published instructors | Published offerings |
| --- | --- | ---: | ---: |
| 92NY School of Music | school | 0 | 3 |
| Atlantic Acting School | school | 1 | 1 |
| Bloomingdale School of Music | school | 5 | 4 |
| Brooklyn Conservatory of Music | school | 10 | 4 |
| Brooklyn Music School | school | 6 | 0 |
| Greenwich House Music School | school | 4 | 0 |
| HB Studio | school | 0 | 5 |
| Liz Caplan Vocal Studios | studio | 3 | 0 |
| Lucy Moses School | school | 9 | 3 |
| Maggie Flanigan Studio | school | 0 | 4 |
| Manhattan School of Music | school | 32 | 0 |
| Mannes School of Music | school | 15 | 0 |
| Matt Farnsworth Voice Studio | studio | 5 | 0 |
| NYU Steinhardt Vocal Performance | school | 34 | 0 |
| New York Jazz Academy | school | 11 | 1 |
| New York Jazz Workshop | school | 4 | 0 |
| New York Speech Coaching | school | 10 | 0 |
| New York Vocal Coaching | studio | 12 | 1 |
| The Barrow Group | school | 0 | 2 |
| The Diller-Quaile School of Music | school | 3 | 0 |
| Third Street Music School | school | 5 | 0 |
| Voice Academy NYC | studio | 15 | 0 |

The stored `school`/`studio` values are a useful starting point, not yet a complete reviewed mapping to Institution or Studio / Business. No current provider row is stored as `coach`.

### Root cause

The relational model already has the needed entities and links: providers, instructors, offerings, provider-instructor joins, offering-instructor joins, and `offerings.provider_id`. All published courses are linked to providers, so there are no orphaned offerings to repair in production.

The duplication is chiefly in presentation and URL inventory. The homepage combines instructors and offerings as its default results and omits providers from that collection. SEO separately emits profile pages for all three kinds. Thus a faculty member and each course can appear as primary searchable/indexable results alongside the institution, even though the database already groups them. Course records are not stored in the provider table, but their current standalone result/profile treatment conflicts with the one-provider primary-listing rule.

### Duplicates, source reuse, and canonical URL issues

- **No same-host provider pairs were found among the 22 current providers.** There is no evidence for merging current provider IDs based only on domains. Mannes is on a New School subdomain; it is a separate named institution and should remain distinct.
- **Nine groups of instructor records share an identical website URL** (after ignoring a trailing slash). These are roster, team, or program URLs shared by different named people, not evidence that the people are duplicates. Preserve each person as an instructor relation and never deduplicate them on URL alone.
- Several provider `website_url` values point to a course or faculty page rather than a general provider page. For example, the 92NY provider currently points to its Everybody Can Sing course page; Bloomingdale, Brooklyn Music School, Lucy Moses, and other providers point to roster pages. Keep those URLs as evidence, then review the canonical provider URL separately.
- The two Barrow Group level offerings use the same official source URL but have distinct level names/descriptions. Treat as separate offerings unless content review proves otherwise.
- No provider-to-provider merge is recommended from this database pass. URL/source reuse needs per-record review, not a domain uniqueness constraint.

### Proposed record mapping (no destructive merge)

| Current records | Proposed destination/action | Evidence and handling |
| --- | --- | --- |
| 22 provider rows | Keep each existing provider ID as its primary provider record; no provider-to-provider merge proposed. | The 22 provider hostnames are distinct. Review the 18 `school` and 4 `studio` type mappings and replace faculty/course source URLs with provider-level canonicals only after source review. |
| 167 instructor records with verified institutional affiliation | Keep each instructor ID and its verified `provider_instructors` relation as child faculty under the existing provider. | Do not merge a person row into an institution row or remove its verified biography/source. Exclude it from primary provider results. Preserve a unique useful person page as subordinate content. |
| 12 of the 49 affiliation-unconfirmed instructors that have a provider join | Keep the relationship as unconfirmed; do not use it as a verified type/filter match until the source evidence is resolved. | The stored join alone is not enough to claim a current institutional role. |
| 23 unlinked instructor records with distinct professional websites | Hold as independent-provider candidates. Create a separate provider only after confirming the site represents that person's own teaching/coaching practice. | Do not attach them to a school just because a page mentions faculty work. A website or booking platform shared with another business is not a merge key. |
| 14 unlinked NYST directory-only instructor records | Keep their instructor/source records unconfirmed; no independent provider creation proposed without an official practice URL. | The association directory is a source for the person, not evidence that the association is their provider. |
| 29 offering rows | Keep IDs and existing parent provider links; display them below the provider. | All 29 already have `provider_id`. Keep useful course pages as subordinate pages, not primary provider cards. Retire/redirect a page only after checking whether its content is unique and valuable. |

This is a role/relation consolidation rather than a row deletion plan. The 167 + 12 + 37 records account for the current 216 instructors; the 37 unlinked cases are the 23 website candidates plus 14 association-only records. No existing provider duplicate is supported by this audit. The final provider count remains 22 plus any independently verified candidates (at most 23 from this pass); it should not be set to 45 in advance.

### Instructor/provider candidates

The existing institutional audit in `docs/institutional-listing-audit.json` records 167 instructors with verified institutional affiliation evidence and 49 whose affiliation remains unconfirmed. Its source-pattern scan flagged 82 faculty-page URL candidates; those patterns are hints only. Production D1 confirms all 216 `teacher_type` values are null, so the stored type field itself currently classifies no teacher as independent or institutional.

Of the 37 instructors with no provider relationship:

- **23 have a distinct professional website URL** and are candidates for review as independent-provider records. They include Amy Stoller, Ben Furey, Cynthia Santos DeCure, Danny Bryck, Daryll Heysham, Deena Kaye, Deric Rosenblatt, Eliza Simpson, Elizabeth Abbott, Erik Singer, Joel Goldes, Julie Foh, Kristen Cerelli, Leigh Dillon, Linda Jones, Mary Setrakian, Melanie Fox, Michael Forman, Mike Walsh, Patricia Fletcher, Ricardo López-Montilla, Shane Ann Younts, and Sherry Boone. A personal/professional URL alone does not prove an independently operated teaching business or current availability; verify each before creating a provider.
- **14 have no personal website URL in the record** and cite the NYST teacher directory as their source: Alison Bolshoi, Charlotte Surkin, David Sabella, Dawn Winiarz, Debra Vanderlinde, Debra Wiley-Hart, Elissa Weiss, Jan Horvath, Josephine Mongiardo-Cooper, Lily Librach, Lisa Rochelle, Nancy Adams, Paula Liscio, and Wilma Wever. Keep these unconfirmed; obtain an official provider URL before promoting any to a primary provider listing.

There are also instructors already linked to an institution for whom an independent practice may exist. The current data does not establish that, so those require a separate practice/site check before a second provider is created.

**Provider-count estimate:** 22 existing provider records are the safe starting set. Up to 23 additional providers are candidates, not approved additions; the final count is not yet established. The 14 association-only records are not currently eligible for a distinct primary provider without an official provider URL. The 29 existing offerings remain subordinate to their current providers.

### Format and type evidence

- No published offering has verified `lesson_format_workshop` evidence in production.
- Seventeen of 29 published offerings have verified `instruction_mode=group`; 12 have `instruction_mode=group` stored without matching verified evidence. The latter must remain unconfirmed for filtering until reviewed.
- No verified private/one-on-one or workshop lesson formats were found on published offerings. The presence of “workshop” in a name or source page is not enough to mark the format without the corresponding verified evidence.
- Instructor `in_person` and `online` values describe delivery/location format, not private/group lesson format. Do not translate them into lesson classifications.
- Existing source audit reports all 216 current availability states as unconfirmed. Keep availability separate from provider type and lesson format.

## Proposed migration and consolidation plan

The original audit itself did not authorize production changes. The user subsequently approved the plan. The audited implementation has no provider merges or canonical URL changes, so it does not create merge redirects. The approved production sequence is backup verification, additive migrations, application deployment, and live read-only verification:

1. Take and verify a production D1 export before any approved schema/data operation.
2. Apply the already prepared additive migration `0015_provider_identity_registry.sql` only after approval. It adds nullable `providers.provider_classification`, `provider_site_urls` for exact URL roles, and an auditable `provider_url_redirects` registry. It does not backfill or merge records. No global URL/domain uniqueness is imposed.
3. Retain the existing 22 provider IDs and slugs as canonical starting IDs. Review each current `school`/`studio` mapping and each primary official URL. Record approved URL variants and evidence in the new URL table; preserve existing `website_url`/`source_url` during review.
4. Keep all 29 offering IDs, URLs, verified details, and existing provider links. Mark them as child content in directory queries. Keep course SEO pages only where their content is materially useful; never include them in provider result counts.
5. Keep all 216 instructor IDs and their evidence. Retain current affiliations; confirm or correct them individually. Evaluate the 23 personal-site and 14 association-only cases; only verified, distinct practices become provider records. Do not merge two different people because their source URL is the same.
6. Create a reviewed old-to-new URL/ID map before changing routes. Keep established provider canonicals. Preserve useful teacher/course pages as subordinate content; redirect only confirmed duplicate or retired URLs, using an approved mapping and the redirect audit table. Update canonical tags and sitemap from the same provider/retained-content registry.
7. Preserve saved-listing IDs through compatibility mapping. Preserve provider and instructor claims, submissions, evidence, admin approvals, and source URLs. Do not delete these records as a side effect of consolidation.
8. Update submission/import review to distinguish provider, offering, and instructor before insert. Normalize exact URLs for candidate search, but treat host collisions as review candidates—not a database uniqueness rule. Keep uncertain submissions pending in the existing admin workflow.

## Application changes after data mapping approval

- Make provider records the sole primary directory collection. The default All view contains one card per provider, including unconfirmed providers; provider filters separate Independent, Studio, and Institution.
- Match lesson-format filters against verified offerings attached to each provider. Preserve multiple formats per provider and leave unknown format data out of filtered matches.
- Show provider type, verified location/specialties/formats, official provider link, save control, and expandable courses/instructors. Do not show booking availability without fresh verified evidence.
- Keep existing search, price, sorting, pagination, responsive layout, and saved/claim/remove flows. Provider claim support exists in D1; the current visible claim/remove affordance is teacher-focused and will need to be exposed on provider profiles.

## Rollback and approval boundary

Migrations 0015 through 0018 are additive. If later found incompatible, first roll back the application code to a version that ignores the added fields/tables; leave the schema objects in place rather than dropping them during incident recovery. Any data consolidation should use a reviewed mapping and a verified pre-change backup. Restore or reverse individual mappings only from that ledger; do not attempt an unreviewed global merge rollback.

Production reads were limited to published provider/instructor/offering counts, names, URLs, relationship counts, type/format evidence, and the migration ledger. No submissions or contact details were queried. Remote D1 reports migrations 0015 and 0016 as pending. No tests were run for this audit.

## Local database update

After the audit, the user authorized changes to the internal database. Migrations 0015 through 0018 are applied to local D1 only. The backfill maps existing published `school` and `studio` values to `institution` and `studio_business`; all 22 current provider websites had matching verified official-source records, so they were added to `provider_site_urls` as verified primary official URLs. Migration 0018 prevents exact repeated provider, teacher, and provider-offering identities in future imports while allowing separate businesses on the same domain. It made no instructor/provider merges, offering record changes, classification guesses for instructors, or production changes. Local verification found 18 institutions, 4 studio/business providers, 22 verified primary URLs, zero missing registry rows, and no foreign-key violations.

## Follow-up UI release

On November 15, 2026, the homepage hero counters were updated to show primary providers, instructors, and offerings as separate database collections. The production Worker deployed successfully as version `496805db-4913-4d82-a683-aaa5994a9cdb`. A read-only production API check returned HTTP 200 and the expected counts: 22 providers, 216 instructors, and 29 offerings. This release changed the counters only; it did not consolidate listings or apply migrations 0015/0016 to production.

## Approved provider-first implementation

On November 16, 2026, the user approved the audited provider-first plan. The application now uses providers as the sole primary directory results; classes, workshops, and verified institutional faculty are nested under the parent provider. All existing instructor, offering, provider, saved-listing, claim, and removal records remain intact. No provider merge was justified by the official-site audit. Provider filters now use the four-way classification vocabulary; class filters use verified offerings and never infer private lessons. New offering submissions require an existing provider, and provider, teacher, and offering import guards compare exact identity instead of shared hostnames. Unlinked teacher profile URLs remain accessible but are not indexed as primary listings until verified under a provider.

Production migrations 0015 through 0018 were applied successfully to `acting-class-directory`; the production Worker and assets were deployed to `vocalcatalog.com` as version `57622523-8f8e-4f13-8820-cc806f340cbf`. The shared public snapshot was invalidated through the existing authenticated cache endpoint after the first live check detected stale pre-refactor directory data. Follow-up live API verification returned 22 providers, 216 instructors, 29 offerings, and provider classifications of 18 institutions plus 4 studio/businesses. The homepage and a provider profile returned the new title/type/content and canonical metadata; sitemap index includes provider and verified faculty profile groups. The 22/216/29 source records were preserved, with no identity merges or deletions.
